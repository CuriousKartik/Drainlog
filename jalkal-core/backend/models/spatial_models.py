"""
JalKal (जलकाल) - Spatial ORM Models (PostGIS)
Module: backend/models/spatial_models.py
"""

import uuid
from sqlalchemy import (
    Column,
    String,
    Numeric,
    Integer,
    BigInteger,
    ForeignKey,
    DateTime,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from backend.db.session import Base


class DrainNode(Base):
    """
    Manhole, street inlet, or catch-basin receiving runoff.
    """
    __tablename__ = "drain_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_code = Column(String(64), unique=True, nullable=False, index=True)
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    z_ground = Column(Numeric(8, 3), nullable=False)           # Ground elevation (m)
    z_invert = Column(Numeric(8, 3), nullable=False)           # Sump/invert elevation (m)
    basin_area_m2 = Column(Numeric(12, 2), nullable=False)     # Catchment area (m2)
    curb_length_m = Column(Numeric(6, 2), default=3.0)         # Curb inlet length (m)
    c_runoff = Column(Numeric(4, 2), default=0.90)             # Runoff coefficient
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    outgoing_conduits = relationship(
        "DrainConduit", foreign_keys="DrainConduit.source_node", back_populates="source"
    )
    incoming_conduits = relationship(
        "DrainConduit", foreign_keys="DrainConduit.target_node", back_populates="target"
    )


class DrainConduit(Base):
    """
    Underground pipe, culvert, or storm drain channel.
    """
    __tablename__ = "drain_conduits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conduit_code = Column(String(64), unique=True, nullable=False, index=True)
    source_node = Column(UUID(as_uuid=True), ForeignKey("drain_nodes.id", ondelete="CASCADE"), nullable=False)
    target_node = Column(UUID(as_uuid=True), ForeignKey("drain_nodes.id", ondelete="CASCADE"), nullable=False)
    geom = Column(Geometry(geometry_type="LINESTRING", srid=4326), nullable=False)
    diameter_m = Column(Numeric(6, 3), nullable=False)          # Pipe diameter (m)
    length_m = Column(Numeric(10, 3), nullable=False)           # Length (m)
    manning_n = Column(Numeric(6, 4), default=0.014)            # Roughness n
    clogging_ratio = Column(Numeric(4, 3), default=0.000)       # Clogging factor alpha [0, 1]
    slope = Column(Numeric(8, 5), default=0.005)                # Bed slope (m/m)
    design_q_m3s = Column(Numeric(10, 4), nullable=True)        # Gravity capacity
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    source = relationship("DrainNode", foreign_keys=[source_node], back_populates="outgoing_conduits")
    target = relationship("DrainNode", foreign_keys=[target_node], back_populates="incoming_conduits")


class RoadSegment(Base):
    """
    Road network edges derived from OpenStreetMap topologies.
    """
    __tablename__ = "road_segments"

    id = Column(BigInteger, primary_key=True)                  # OSM Way ID
    osm_id = Column(BigInteger, nullable=False, index=True)
    road_name = Column(String(255), default="Unnamed Street")
    highway_type = Column(String(64), default="residential")
    geom = Column(Geometry(geometry_type="LINESTRING", srid=4326), nullable=False)
    base_speed_kmh = Column(Numeric(5, 2), default=40.0)
    length_m = Column(Numeric(10, 3), nullable=False)
    source_vertex = Column(BigInteger, nullable=True)
    target_vertex = Column(BigInteger, nullable=True)
    z_elevation = Column(Numeric(8, 3), default=10.0)
    curb_height_m = Column(Numeric(4, 2), default=0.15)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    inundation_logs = relationship("LiveInundationLog", back_populates="road_segment", cascade="all, delete-orphan")


class LiveInundationLog(Base):
    """
    Dynamic street flood depth predictions for each time horizon (0, 15, ..., 180 min).
    """
    __tablename__ = "live_inundation_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    road_segment_id = Column(BigInteger, ForeignKey("road_segments.id", ondelete="CASCADE"), nullable=False)
    timestamp_horizon_min = Column(Integer, nullable=False, index=True)  # 0 to 180 min
    water_depth_cm = Column(Numeric(6, 2), nullable=False)               # Depth (cm)
    flow_velocity_ms = Column(Numeric(5, 2), default=0.0)                # Velocity (m/s)
    status = Column(String(32), nullable=False)                          # PASSABLE, SLOW, IMPASSABLE
    hazard_penalty = Column(Numeric(8, 2), default=1.0)                  # Impedance multiplier
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    road_segment = relationship("RoadSegment", back_populates="inundation_logs")

