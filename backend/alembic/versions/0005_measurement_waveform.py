"""measurement_details + waveform_data columns on test_results

Revision ID: 0005
Revises:     0004
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("test_results", sa.Column("measurement_details", sa.JSON(), nullable=True))
    op.add_column("test_results", sa.Column("waveform_data",       sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("test_results", "waveform_data")
    op.drop_column("test_results", "measurement_details")
