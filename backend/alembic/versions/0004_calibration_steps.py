"""calibration_events table + test_results.steps column

Revision ID: 0004
Revises:     0003
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "calibration_events",
        sa.Column("id",            sa.Integer(),     nullable=False),
        sa.Column("asset_id",      sa.Integer(),     sa.ForeignKey("assets.id"), nullable=False),
        sa.Column("performed_at",  sa.DateTime(),    nullable=False),
        sa.Column("performed_by",  sa.String(128),   nullable=False),
        sa.Column("result",        sa.String(16),    nullable=False),
        sa.Column("notes",         sa.Text(),        nullable=True),
        sa.Column("next_due_date", sa.Date(),        nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_calibration_events_asset_id", "calibration_events", ["asset_id"])
    op.add_column("test_results", sa.Column("steps", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("test_results", "steps")
    op.drop_index("ix_calibration_events_asset_id", table_name="calibration_events")
    op.drop_table("calibration_events")
