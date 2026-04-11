"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id",         sa.Integer, primary_key=True, index=True),
        sa.Column("username",   sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("full_name",  sa.String(128), nullable=True),
        sa.Column("email",      sa.String(256), unique=True, nullable=True),
        sa.Column("role",       sa.String(32), nullable=False, server_default="viewer"),
        sa.Column("is_active",  sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_table(
        "api_keys",
        sa.Column("id",           sa.Integer, primary_key=True, index=True),
        sa.Column("key_hash",     sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("label",        sa.String(128), nullable=True),
        sa.Column("user_id",      sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("is_active",    sa.Boolean, nullable=False, server_default="true"),
        sa.Column("last_used_at", sa.DateTime, nullable=True),
        sa.Column("created_at",   sa.DateTime, server_default=sa.func.now()),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id",               sa.Integer, primary_key=True, index=True),
        sa.Column("user_identifier",  sa.String(128), nullable=True),
        sa.Column("action",           sa.String(64), nullable=True),
        sa.Column("resource_type",    sa.String(64), nullable=True),
        sa.Column("resource_id",      sa.Integer, nullable=True),
        sa.Column("detail",           sa.JSON, nullable=True),
        sa.Column("timestamp",        sa.DateTime, server_default=sa.func.now(), index=True),
    )
    op.create_table(
        "assets",
        sa.Column("id",               sa.Integer, primary_key=True, index=True),
        sa.Column("name",             sa.String, unique=True, nullable=False, index=True),
        sa.Column("model",            sa.String, nullable=True),
        sa.Column("asset_type",       sa.String, nullable=True),
        sa.Column("serial_number",    sa.String, unique=True, nullable=True),
        sa.Column("ip_address",       sa.String, nullable=True),
        sa.Column("location",         sa.String, nullable=True),
        sa.Column("department",       sa.String, nullable=True),
        sa.Column("firmware_version", sa.String, nullable=True),
        sa.Column("driver_version",   sa.String, nullable=True),
        sa.Column("status",           sa.String, nullable=False, server_default="offline"),
        sa.Column("last_seen",        sa.DateTime, nullable=True),
        sa.Column("created_at",       sa.DateTime, server_default=sa.func.now()),
        sa.Column("channel_count",    sa.Integer, nullable=False, server_default="0"),
        sa.Column("tags",             sa.JSON, nullable=True),
    )
    op.create_table(
        "deployments",
        sa.Column("id",              sa.Integer, primary_key=True, index=True),
        sa.Column("name",            sa.String, nullable=True),
        sa.Column("package_name",    sa.String, nullable=True),
        sa.Column("package_version", sa.String, nullable=True),
        sa.Column("status",          sa.String, nullable=False, server_default="pending"),
        sa.Column("created_by",      sa.String, nullable=True),
        sa.Column("created_at",      sa.DateTime, server_default=sa.func.now()),
        sa.Column("started_at",      sa.DateTime, nullable=True),
        sa.Column("completed_at",    sa.DateTime, nullable=True),
        sa.Column("success_count",   sa.Integer, nullable=False, server_default="0"),
        sa.Column("fail_count",      sa.Integer, nullable=False, server_default="0"),
        sa.Column("notes",           sa.Text, nullable=True),
    )
    op.create_table(
        "deployment_targets",
        sa.Column("id",            sa.Integer, primary_key=True, index=True),
        sa.Column("deployment_id", sa.Integer, sa.ForeignKey("deployments.id"), nullable=False),
        sa.Column("asset_id",      sa.Integer, sa.ForeignKey("assets.id"), nullable=False),
        sa.Column("status",        sa.String, nullable=False, server_default="pending"),
        sa.Column("log",           sa.Text, nullable=True),
        sa.Column("started_at",    sa.DateTime, nullable=True),
        sa.Column("completed_at",  sa.DateTime, nullable=True),
    )
    op.create_table(
        "test_results",
        sa.Column("id",           sa.Integer, primary_key=True, index=True),
        sa.Column("asset_id",     sa.Integer, sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("test_name",    sa.String, nullable=True),
        sa.Column("status",       sa.String, nullable=True),
        sa.Column("duration",     sa.Float, nullable=True),
        sa.Column("started_at",   sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("measurements", sa.JSON, nullable=True),
        sa.Column("operator",     sa.String, nullable=True),
        sa.Column("notes",        sa.Text, nullable=True),
    )
    op.create_table(
        "alarms",
        sa.Column("id",               sa.Integer, primary_key=True, index=True),
        sa.Column("asset_id",         sa.Integer, sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("severity",         sa.String, nullable=True),
        sa.Column("category",         sa.String, nullable=True),
        sa.Column("message",          sa.String, nullable=True),
        sa.Column("is_active",        sa.Boolean, nullable=False, server_default="true"),
        sa.Column("triggered_at",     sa.DateTime, server_default=sa.func.now()),
        sa.Column("acknowledged_at",  sa.DateTime, nullable=True),
        sa.Column("acknowledged_by",  sa.String, nullable=True),
    )
    op.create_table(
        "agent_nodes",
        sa.Column("id",             sa.Integer, primary_key=True, index=True),
        sa.Column("agent_id",       sa.String(128), unique=True, nullable=False, index=True),
        sa.Column("hostname",       sa.String(256), nullable=True),
        sa.Column("version",        sa.String(32), nullable=True),
        sa.Column("status",         sa.String(32), nullable=False, server_default="offline"),
        sa.Column("last_heartbeat", sa.DateTime, nullable=True),
        sa.Column("ip_address",     sa.String(64), nullable=True),
        sa.Column("capabilities",   sa.JSON, nullable=True),
    )
    op.create_table(
        "agent_inventory",
        sa.Column("id",           sa.Integer, primary_key=True, index=True),
        sa.Column("agent_id",     sa.Integer, sa.ForeignKey("agent_nodes.id"), nullable=False),
        sa.Column("package_name", sa.String(256), nullable=True),
        sa.Column("version",      sa.String(64), nullable=True),
        sa.Column("install_path", sa.String(512), nullable=True),
        sa.Column("recorded_at",  sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("agent_inventory")
    op.drop_table("agent_nodes")
    op.drop_table("alarms")
    op.drop_table("test_results")
    op.drop_table("deployment_targets")
    op.drop_table("deployments")
    op.drop_table("assets")
    op.drop_table("audit_logs")
    op.drop_table("api_keys")
    op.drop_table("users")
