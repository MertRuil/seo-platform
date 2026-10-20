"""Persist site-scoped backlink records."""
from alembic import op
import sqlalchemy as sa

revision = "20261018_backlinks"
down_revision = "20261015_complete_schema"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("backlinks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("site_id", sa.String(36), sa.ForeignKey("sites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_url", sa.String(2048), nullable=False),
        sa.Column("source_domain", sa.String(255), nullable=False),
        sa.Column("target_url", sa.String(2048), nullable=False),
        sa.Column("anchor_text", sa.Text, nullable=False),
        sa.Column("anchor_category", sa.String(30), nullable=False),
        sa.Column("is_dofollow", sa.Boolean, nullable=False),
        sa.Column("domain_authority", sa.Integer, nullable=False),
        sa.Column("page_authority", sa.Integer, nullable=False),
        sa.Column("spam_score", sa.Integer, nullable=False),
        sa.Column("is_toxic", sa.Boolean, nullable=False),
        sa.Column("toxicity_risk", sa.String(20), nullable=False),
        sa.Column("toxicity_reasons", sa.JSON, nullable=False),
        sa.Column("first_seen", sa.String(10), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("data_source", sa.String(50), nullable=False),
        sa.Column("verified_live", sa.Boolean, nullable=False),
        sa.Column("http_status", sa.Integer, nullable=True),
        sa.Column("rel_attributes", sa.JSON, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("site_id", "source_url", "target_url", name="uq_backlink_site_source_target"))
    op.create_index("ix_backlinks_site_id", "backlinks", ["site_id"])
    op.create_index("ix_backlinks_source_domain", "backlinks", ["source_domain"])

def downgrade():
    op.drop_index("ix_backlinks_source_domain", table_name="backlinks")
    op.drop_index("ix_backlinks_site_id", table_name="backlinks")
    op.drop_table("backlinks")
