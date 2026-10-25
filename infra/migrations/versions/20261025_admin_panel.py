"""Platform-level audit entries (no organization) and last login time for the admin panel."""
from alembic import op
import sqlalchemy as sa

revision = "20261025_admin_panel"
down_revision = "20261021_rec_proposed_change"
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table("audit_logs") as batch:
        batch.alter_column("organization_id", existing_type=sa.String(36), nullable=True)
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))

def downgrade():
    op.drop_column("users", "last_login_at")
    op.execute("DELETE FROM audit_logs WHERE organization_id IS NULL")
    with op.batch_alter_table("audit_logs") as batch:
        batch.alter_column("organization_id", existing_type=sa.String(36), nullable=False)
