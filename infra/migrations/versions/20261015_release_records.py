"""Persist password recovery challenges and customer lead records."""
from alembic import op
import sqlalchemy as sa

revision = "20261015_release_records"
down_revision = "8eebae4cd92e"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("password_reset_challenges",
        sa.Column("id",sa.String(36),primary_key=True),
        sa.Column("user_id",sa.String(36),sa.ForeignKey("users.id",ondelete="CASCADE"),nullable=False),
        sa.Column("token_hash",sa.String(64),nullable=False,unique=True),
        sa.Column("code_hash",sa.String(64),nullable=False),
        sa.Column("attempts",sa.Integer,nullable=False),
        sa.Column("expires_at",sa.DateTime(timezone=True),nullable=False))
    op.create_index("ix_password_reset_challenges_user_id","password_reset_challenges",["user_id"])
    op.create_index("ix_password_reset_challenges_token_hash","password_reset_challenges",["token_hash"],unique=True)
    op.create_table("lead_records",
        sa.Column("id",sa.String(36),primary_key=True),
        sa.Column("organization_id",sa.String(36),sa.ForeignKey("organizations.id",ondelete="CASCADE"),nullable=False),
        sa.Column("site_id",sa.String(36),sa.ForeignKey("sites.id",ondelete="CASCADE"),nullable=False),
        sa.Column("payload_json",sa.Text,nullable=False),
        sa.Column("created_at",sa.DateTime(timezone=True),nullable=False))
    op.create_index("ix_lead_records_organization_id","lead_records",["organization_id"])
    op.create_index("ix_lead_records_site_id","lead_records",["site_id"])

def downgrade():
    op.drop_table("lead_records")
    op.drop_table("password_reset_challenges")
