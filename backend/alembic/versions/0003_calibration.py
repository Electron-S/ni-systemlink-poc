"""교정 일정 관리 필드 추가

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("assets", sa.Column("calibration_due_date",      sa.Date(),    nullable=True))
    op.add_column("assets", sa.Column("calibration_interval_days", sa.Integer(), nullable=True,
                                      server_default="365"))


def downgrade() -> None:
    op.drop_column("assets", "calibration_interval_days")
    op.drop_column("assets", "calibration_due_date")
