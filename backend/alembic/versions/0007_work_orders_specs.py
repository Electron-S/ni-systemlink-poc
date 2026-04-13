"""작업 지시 + 테스트 규격 테이블 추가

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "work_orders",
        sa.Column("id",              sa.Integer(),     primary_key=True, index=True),
        sa.Column("title",           sa.String(256),   nullable=False),
        sa.Column("asset_id",        sa.Integer(),     sa.ForeignKey("assets.id"), nullable=False),
        sa.Column("operator",        sa.String(128),   nullable=False),
        sa.Column("scheduled_start", sa.DateTime(),    nullable=False),
        sa.Column("scheduled_end",   sa.DateTime(),    nullable=False),
        sa.Column("test_plan",       sa.String(256),   nullable=True),
        sa.Column("dut_id",          sa.String(128),   nullable=True),
        sa.Column("priority",        sa.String(16),    server_default="normal"),
        sa.Column("status",          sa.String(32),    server_default="scheduled"),
        sa.Column("notes",           sa.Text(),        nullable=True),
        sa.Column("created_at",      sa.DateTime(),    server_default=sa.func.now()),
    )
    op.create_index("ix_work_orders_asset_id",  "work_orders", ["asset_id"])
    op.create_index("ix_work_orders_status",    "work_orders", ["status"])
    op.create_index("ix_work_orders_scheduled_start", "work_orders", ["scheduled_start"])

    op.create_table(
        "test_specs",
        sa.Column("id",               sa.Integer(),    primary_key=True, index=True),
        sa.Column("product",          sa.String(128),  nullable=False, index=True),
        sa.Column("spec_version",     sa.String(64),   nullable=False, server_default="v1.0"),
        sa.Column("corner",           sa.String(32),   nullable=True),
        sa.Column("measurement_name", sa.String(128),  nullable=False, index=True),
        sa.Column("spec_min",         sa.Float(),      nullable=True),
        sa.Column("spec_max",         sa.Float(),      nullable=True),
        sa.Column("unit",             sa.String(32),   nullable=True),
        sa.Column("is_active",        sa.Boolean(),    server_default=sa.true()),
        sa.Column("created_by",       sa.String(128),  nullable=False),
        sa.Column("created_at",       sa.DateTime(),   server_default=sa.func.now()),
        sa.Column("notes",            sa.Text(),       nullable=True),
    )


def downgrade():
    op.drop_table("test_specs")
    op.drop_index("ix_work_orders_scheduled_start", table_name="work_orders")
    op.drop_index("ix_work_orders_status",          table_name="work_orders")
    op.drop_index("ix_work_orders_asset_id",        table_name="work_orders")
    op.drop_table("work_orders")
