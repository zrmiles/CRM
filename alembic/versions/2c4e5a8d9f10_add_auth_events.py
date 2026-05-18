"""add auth events

Revision ID: 2c4e5a8d9f10
Revises: b7e8991aa80f
Create Date: 2026-04-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2c4e5a8d9f10"
down_revision: Union[str, None] = "b7e8991aa80f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auth_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_type", sa.String(length=30), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_auth_events_email"), "auth_events", ["email"], unique=False)
    op.create_index(op.f("ix_auth_events_event_type"), "auth_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_auth_events_success"), "auth_events", ["success"], unique=False)
    op.create_index(op.f("ix_auth_events_user_id"), "auth_events", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_auth_events_user_id"), table_name="auth_events")
    op.drop_index(op.f("ix_auth_events_success"), table_name="auth_events")
    op.drop_index(op.f("ix_auth_events_event_type"), table_name="auth_events")
    op.drop_index(op.f("ix_auth_events_email"), table_name="auth_events")
    op.drop_table("auth_events")
