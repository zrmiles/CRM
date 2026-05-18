"""translate default stages to russian

Revision ID: 8e3f7a1d2c9b
Revises: 4f12b0c8a774
Create Date: 2026-05-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "8e3f7a1d2c9b"
down_revision: Union[str, None] = "4f12b0c8a774"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


STAGE_TRANSLATIONS = {
    "New": "Новая",
    "Qualification": "Квалификация",
    "Proposal": "Предложение",
    "Negotiation": "Переговоры",
    "Closed Won": "Успешно закрыта",
    "Closed Lost": "Проиграна",
}


def upgrade() -> None:
    for english_name, russian_name in STAGE_TRANSLATIONS.items():
        op.execute(
            f"UPDATE stages SET name = '{russian_name}' WHERE name = '{english_name}'"
        )


def downgrade() -> None:
    for english_name, russian_name in STAGE_TRANSLATIONS.items():
        op.execute(
            f"UPDATE stages SET name = '{english_name}' WHERE name = '{russian_name}'"
        )
