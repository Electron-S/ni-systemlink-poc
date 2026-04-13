"""섀시-슬롯 관계 컬럼 추가

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("assets", sa.Column("chassis_id",  sa.Integer(), sa.ForeignKey("assets.id"), nullable=True))
    op.add_column("assets", sa.Column("slot_number", sa.Integer(), nullable=True))
    op.create_index("ix_assets_chassis_id", "assets", ["chassis_id"])


def downgrade():
    op.drop_index("ix_assets_chassis_id", table_name="assets")
    op.drop_column("assets", "slot_number")
    op.drop_column("assets", "chassis_id")
