"""
JalKal (जलकाल) - Atmospheric Nowcasting Engine
Module: ml_engine/radar_nowcast.py

Deep Learning Spatio-Temporal Nowcasting using PyTorch ConvLSTM.
Predicts 12 future frames (T+15m to T+180m, at 15-minute intervals) from 4 historical
Doppler Weather Radar (DWR) reflectivity frames (B, 4, 1, H, W).
Includes Marshall-Palmer Z-R conversion to derive surface rainfall intensity (mm/hr).
"""

from typing import Tuple, List, Optional
import math
import torch
import torch.nn as nn
import numpy as np


class ConvLSTMCell(nn.Module):
    """
    2D Convolutional Long Short-Term Memory (ConvLSTM) Cell.
    Preserves 2D spatial dimensions while learning temporal state transitions.
    """

    def __init__(self, in_channels: int, hidden_channels: int, kernel_size: int = 3):
        super().__init__()
        self.in_channels = in_channels
        self.hidden_channels = hidden_channels
        padding = kernel_size // 2

        # 4 gates: input, forget, cell candidate, output
        self.conv = nn.Conv2d(
            in_channels=in_channels + hidden_channels,
            out_channels=4 * hidden_channels,
            kernel_size=kernel_size,
            padding=padding,
            bias=True,
        )

    def forward(
        self, x: torch.Tensor, hx: Optional[Tuple[torch.Tensor, torch.Tensor]] = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass for one time step.
        :param x: Input tensor of shape (B, C_in, H, W)
        :param hx: Tuple of (h, c), each of shape (B, C_hidden, H, W)
        :return: Tuple of updated (h, c)
        """
        batch_size, _, height, width = x.size()

        if hx is None:
            h = torch.zeros(
                batch_size, self.hidden_channels, height, width, device=x.device
            )
            c = torch.zeros(
                batch_size, self.hidden_channels, height, width, device=x.device
            )
        else:
            h, c = hx

        combined = torch.cat([x, h], dim=1)
        gates = self.conv(combined)
        i, f, o, g = torch.split(gates, self.hidden_channels, dim=1)

        i = torch.sigmoid(i)
        f = torch.sigmoid(f)
        o = torch.sigmoid(o)
        g = torch.tanh(g)

        c_next = f * c + i * g
        h_next = o * torch.tanh(c_next)

        return h_next, c_next


class RadarConvLSTMNowcaster(nn.Module):
    """
    Sequence-to-Sequence ConvLSTM Radar Nowcaster.
    Input: (Batch, In_Steps=4, Channels=1, Height, Width) [Historical Doppler Radar dBZ]
    Output: (Batch, Out_Steps=12, Channels=1, Height, Width) [15m to 180m forecast]
    """

    def __init__(
        self,
        in_channels: int = 1,
        hidden_dim: int = 32,
        out_channels: int = 1,
        num_past_steps: int = 4,
        num_future_steps: int = 12,
    ):
        super().__init__()
        self.num_past_steps = num_past_steps
        self.num_future_steps = num_future_steps

        # Multi-layer ConvLSTM encoder-decoder
        self.cell1 = ConvLSTMCell(in_channels, hidden_dim, kernel_size=3)
        self.cell2 = ConvLSTMCell(hidden_dim, hidden_dim, kernel_size=3)

        # Output projection head mapping hidden representations to reflectivity (dBZ)
        self.out_conv = nn.Sequential(
            nn.Conv2d(hidden_dim, hidden_dim // 2, kernel_size=3, padding=1),
            nn.LeakyReLU(0.1),
            nn.Conv2d(hidden_dim // 2, out_channels, kernel_size=1),
            nn.ReLU(),  # Reflectivity dBZ is >= 0
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        :param x: Tensor of shape (B, T_in, 1, H, W)
        :return: Tensor of shape (B, T_out, 1, H, W)
        """
        batch_size, seq_len, _, height, width = x.size()

        h1, c1 = None, None
        h2, c2 = None, None

        # 1. Encode historical observations
        for t in range(seq_len):
            x_t = x[:, t]  # (B, 1, H, W)
            h1, c1 = self.cell1(x_t, (h1, c1) if h1 is not None else None)
            h2, c2 = self.cell2(h1, (h2, c2) if h2 is not None else None)

        # 2. Decode future nowcast trajectory auto-regressively
        outputs: List[torch.Tensor] = []
        current_input = self.out_conv(h2)

        for _ in range(self.num_future_steps):
            h1, c1 = self.cell1(current_input, (h1, c1))
            h2, c2 = self.cell2(h1, (h2, c2))
            pred = self.out_conv(h2)
            outputs.append(pred)
            current_input = pred  # Recursive roll-out

        # Stack across time dimension -> (B, num_future_steps, 1, H, W)
        return torch.stack(outputs, dim=1)


class MarshallPalmerConverter:
    """
    Marshall-Palmer Empirical Radar Reflectivity to Rainfall Rate relation:
        Z = a * R^b
    Standard Continental Storms: a = 200, b = 1.6
    When reflectivity is expressed in logarithmic decibels of reflectivity (dBZ):
        Z (linear, mm^6/m^3) = 10^(dBZ / 10)
        R (mm/hr) = (Z / a)^(1 / b) = (10^(dBZ / 10) / 200)^(1 / 1.6)
    """

    def __init__(self, a: float = 200.0, b: float = 1.6):
        self.a = a
        self.b = b

    def dbz_to_rainfall_rate(self, dbz: torch.Tensor | np.ndarray) -> torch.Tensor | np.ndarray:
        """
        Converts radar reflectivity dBZ to rain rate R in mm/hr.
        Thresholds sub-cloud clutter (<15 dBZ) to 0.0 mm/hr.
        """
        if isinstance(dbz, torch.Tensor):
            # Threshold noise
            dbz_clean = torch.clamp(dbz, min=0.0)
            linear_z = torch.pow(10.0, dbz_clean / 10.0)
            r = torch.pow(linear_z / self.a, 1.0 / self.b)
            # Mask echoes below 15 dBZ (drizzle/noise threshold)
            mask = dbz >= 15.0
            return torch.where(mask, r, torch.zeros_like(r))
        else:
            dbz_clean = np.clip(dbz, 0.0, None)
            linear_z = np.power(10.0, dbz_clean / 10.0)
            r = np.power(linear_z / self.a, 1.0 / self.b)
            r[dbz < 15.0] = 0.0
            return r

    def rainfall_rate_to_dbz(self, r_mm_hr: torch.Tensor | np.ndarray) -> torch.Tensor | np.ndarray:
        """
        Inverse relation: Rain rate R (mm/hr) -> dBZ.
        """
        if isinstance(r_mm_hr, torch.Tensor):
            r_clean = torch.clamp(r_mm_hr, min=0.001)
            z = self.a * torch.pow(r_clean, self.b)
            return 10.0 * torch.log10(z)
        else:
            r_clean = np.clip(r_mm_hr, 0.001, None)
            z = self.a * np.power(r_clean, self.b)
            return 10.0 * np.log10(z)


def create_synthetic_radar_sequence(
    batch_size: int = 1,
    height: int = 64,
    width: int = 64,
    num_past_steps: int = 4,
    storm_velocity: Tuple[float, float] = (1.5, 0.8),
) -> torch.Tensor:
    """
    Generates synthetic moving convective storm cells (dBZ) simulating DWR radar scans.
    """
    grid_y, grid_x = torch.meshgrid(
        torch.linspace(-1, 1, height), torch.linspace(-1, 1, width), indexing="ij"
    )

    frames = []
    # Convective storm core centers
    cx, cy = -0.3, -0.4
    vx, vy = storm_velocity[0] / width, storm_velocity[1] / height

    for t in range(num_past_steps):
        # Gaussian rain cell moving across grid
        cur_cx = cx + (t * vx)
        cur_cy = cy + (t * vy)
        dist_sq = (grid_x - cur_cx) ** 2 + (grid_y - cur_cy) ** 2
        # Peak reflectivity 55 dBZ (torrential monsoon burst)
        cell_intensity = 55.0 * torch.exp(-dist_sq / 0.05)
        # Background ambient reflectivity
        ambient = torch.randn_like(cell_intensity) * 2.0
        dbz = torch.clamp(cell_intensity + ambient, min=0.0, max=70.0)
        frames.append(dbz.unsqueeze(0))  # (1, H, W)

    sequence = torch.stack(frames, dim=0)  # (4, 1, H, W)
    batch = sequence.unsqueeze(0).repeat(batch_size, 1, 1, 1, 1)  # (B, 4, 1, H, W)
    return batch


if __name__ == "__main__":
    print("[+] Initializing ConvLSTM Radar Nowcaster...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = RadarConvLSTMNowcaster().to(device)
    converter = MarshallPalmerConverter()

    # Generate synthetic 4-frame radar input
    radar_input = create_synthetic_radar_sequence(batch_size=1, height=64, width=64).to(device)
    print(f"[*] Input radar shape (B, T_in, C, H, W): {radar_input.shape}")

    with torch.no_grad():
        forecast_dbz = model(radar_input)
        print(f"[+] Output forecast shape (B, T_out=12, C, H, W): {forecast_dbz.shape}")

        # Convert to rainfall intensity (mm/hr)
        rain_rate = converter.dbz_to_rainfall_rate(forecast_dbz)
        max_rain = float(torch.max(rain_rate))
        print(f"[+] Peak rainfall rate predicted across 3-hour horizon: {max_rain:.2f} mm/hr")

