"""PMIC 추적성 필드 + 에이전트-자산 연결

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # TestResult에 PMIC 추적성 필드 추가
    op.add_column("test_results", sa.Column("dut_id",         sa.String(), nullable=True))
    op.add_column("test_results", sa.Column("board_rev",      sa.String(), nullable=True))
    op.add_column("test_results", sa.Column("silicon_rev",    sa.String(), nullable=True))
    op.add_column("test_results", sa.Column("lot_id",         sa.String(), nullable=True))
    op.add_column("test_results", sa.Column("corner",         sa.String(), nullable=True))
    op.add_column("test_results", sa.Column("recipe_version", sa.String(), nullable=True))

    op.create_index("ix_test_results_dut_id", "test_results", ["dut_id"])
    op.create_index("ix_test_results_lot_id", "test_results", ["lot_id"])

    # AgentNode에 managed_asset_ids 추가
    op.add_column("agent_nodes", sa.Column("managed_asset_ids", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_index("ix_test_results_lot_id", "test_results")
    op.drop_index("ix_test_results_dut_id", "test_results")
    op.drop_column("test_results", "recipe_version")
    op.drop_column("test_results", "corner")
    op.drop_column("test_results", "lot_id")
    op.drop_column("test_results", "silicon_rev")
    op.drop_column("test_results", "board_rev")
    op.drop_column("test_results", "dut_id")
    op.drop_column("agent_nodes", "managed_asset_ids")
