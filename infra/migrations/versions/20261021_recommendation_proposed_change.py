"""Store validated proposed title, meta description and JSON-LD on recommendations."""
from alembic import op
import sqlalchemy as sa

revision = "20261021_rec_proposed_change"
down_revision = "20261018_backlinks"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("recommendations", sa.Column("proposed_change_json", sa.Text, nullable=True))

def downgrade():
    op.drop_column("recommendations", "proposed_change_json")
