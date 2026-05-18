"""add audit log and soft delete/archive flags

Revision ID: 9d2b6e4c1a90
Revises: 8e3f7a1d2c9b
Create Date: 2026-05-18 14:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9d2b6e4c1a90"
down_revision: Union[str, None] = "8e3f7a1d2c9b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("clients", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("clients", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_clients_is_archived"), "clients", ["is_archived"], unique=False)
    op.create_index(op.f("ix_clients_deleted_at"), "clients", ["deleted_at"], unique=False)

    op.add_column("deals", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("deals", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("deals", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_deals_is_archived"), "deals", ["is_archived"], unique=False)
    op.create_index(op.f("ix_deals_deleted_at"), "deals", ["deleted_at"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=30), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("before", sa.JSON(), nullable=True),
        sa.Column("after", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_actor_id"), "audit_logs", ["actor_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_id"), "audit_logs", ["entity_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_type"), "audit_logs", ["entity_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_entity_type"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_entity_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_created_at"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_actor_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_action"), table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index(op.f("ix_deals_deleted_at"), table_name="deals")
    op.drop_index(op.f("ix_deals_is_archived"), table_name="deals")
    op.drop_column("deals", "deleted_at")
    op.drop_column("deals", "archived_at")
    op.drop_column("deals", "is_archived")

    op.drop_index(op.f("ix_clients_deleted_at"), table_name="clients")
    op.drop_index(op.f("ix_clients_is_archived"), table_name="clients")
    op.drop_column("clients", "deleted_at")
    op.drop_column("clients", "archived_at")
    op.drop_column("clients", "is_archived")
