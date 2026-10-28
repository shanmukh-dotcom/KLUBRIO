"""events, registrations, posters, certificates, notifications, exports tables

Revision ID: 6c74742cb044
Revises: 72f93333723b
Create Date: 2026-10-25 12:00:00.000000

Hand-written (no database to autogenerate against), rendered from the models so names
follow the naming convention in app/core/db.py.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "6c74742cb044"
down_revision: str | None = "72f93333723b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Created implicitly by create_table; dropped explicitly in downgrade().
ENUM_TYPES = (
    "certificate_notification_status",
    "certificate_batch_item_status",
    "certificate_status",
    "placeholder_source",
    "placeholder_align",
    "form_field_type",
    "certificate_batch_status",
    "registration_status",
    "poster_render_status",
    "export_filter",
    "export_format",
    "eligibility_operator",
    "eligibility_field",
)


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column("club_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("venue", sa.String(length=200), server_default="", nullable=False),
        sa.Column(
            "approval_required", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("seat_limit", sa.Integer(), nullable=True),
        sa.Column("registration_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("manually_closed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["club_id"], ["clubs.id"], name=op.f("fk_events_club_id_clubs"), ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["students.id"],
            name=op.f("fk_events_created_by_students"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_events")),
    )
    op.create_index(op.f("ix_events_club_id"), "events", ["club_id"], unique=False)
    op.create_table(
        "certificate_templates",
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("file_key", sa.String(length=500), nullable=False),
        sa.Column("has_text_layer", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name=op.f("fk_certificate_templates_event_id_events"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_certificate_templates")),
    )
    op.create_index(
        op.f("ix_certificate_templates_event_id"),
        "certificate_templates",
        ["event_id"],
        unique=False,
    )
    op.create_table(
        "eligibility_rules",
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column(
            "field",
            sa.Enum("department", "year", "section", name="eligibility_field"),
            nullable=False,
        ),
        sa.Column(
            "operator",
            sa.Enum("in", name="eligibility_operator"),
            server_default="in",
            nullable=False,
        ),
        sa.Column("values", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name=op.f("fk_eligibility_rules_event_id_events"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_eligibility_rules")),
    )
    op.create_index(
        op.f("ix_eligibility_rules_event_id"), "eligibility_rules", ["event_id"], unique=False
    )
    op.create_table(
        "exports",
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by", sa.Uuid(), nullable=False),
        sa.Column("format", sa.Enum("csv", "xlsx", name="export_format"), nullable=False),
        sa.Column(
            "filter", sa.Enum("all", "confirmed", "attendees", name="export_filter"), nullable=False
        ),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name=op.f("fk_exports_event_id_events"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["requested_by"],
            ["students.id"],
            name=op.f("fk_exports_requested_by_students"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exports")),
    )
    op.create_index(op.f("ix_exports_event_id"), "exports", ["event_id"], unique=False)
    op.create_table(
        "posters",
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("original_file_key", sa.String(length=500), nullable=False),
        sa.Column("width_px", sa.Integer(), nullable=False),
        sa.Column("height_px", sa.Integer(), nullable=False),
        sa.Column("final_png_key", sa.String(length=500), nullable=True),
        sa.Column("final_pdf_key", sa.String(length=500), nullable=True),
        sa.Column(
            "render_status",
            sa.Enum("none", "queued", "done", "failed", name="poster_render_status"),
            server_default="none",
            nullable=False,
        ),
        sa.Column("uploaded_by", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["event_id"], ["events.id"], name=op.f("fk_posters_event_id_events"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"],
            ["students.id"],
            name=op.f("fk_posters_uploaded_by_students"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_posters")),
    )
    op.create_index(op.f("ix_posters_event_id"), "posters", ["event_id"], unique=False)
    op.create_table(
        "registration_forms",
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name=op.f("fk_registration_forms_event_id_events"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_registration_forms")),
        sa.UniqueConstraint("event_id", name=op.f("uq_registration_forms_event_id")),
    )
    op.create_table(
        "registrations",
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("profile_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "answers",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("pending", "confirmed", "rejected", "cancelled", name="registration_status"),
            nullable=False,
        ),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["decided_by"],
            ["students.id"],
            name=op.f("fk_registrations_decided_by_students"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name=op.f("fk_registrations_event_id_events"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["students.id"],
            name=op.f("fk_registrations_student_id_students"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_registrations")),
        sa.UniqueConstraint(
            "event_id", "student_id", name=op.f("uq_registrations_event_id_student_id")
        ),
    )
    op.create_index(
        op.f("ix_registrations_student_id"), "registrations", ["student_id"], unique=False
    )
    op.create_table(
        "attendance",
        sa.Column("registration_id", sa.Uuid(), nullable=False),
        sa.Column("present", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("marked_by", sa.Uuid(), nullable=True),
        sa.Column("marked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["marked_by"],
            ["students.id"],
            name=op.f("fk_attendance_marked_by_students"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["registration_id"],
            ["registrations.id"],
            name=op.f("fk_attendance_registration_id_registrations"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_attendance")),
        sa.UniqueConstraint("registration_id", name=op.f("uq_attendance_registration_id")),
    )
    op.create_table(
        "certificate_batches",
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column("message_subject", sa.String(length=200), nullable=False),
        sa.Column("message_body", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("running", "done", "done_with_failures", name="certificate_batch_status"),
            server_default="running",
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["students.id"],
            name=op.f("fk_certificate_batches_created_by_students"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name=op.f("fk_certificate_batches_event_id_events"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["certificate_templates.id"],
            name=op.f("fk_certificate_batches_template_id_certificate_templates"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_certificate_batches")),
    )
    op.create_index(
        op.f("ix_certificate_batches_event_id"), "certificate_batches", ["event_id"], unique=False
    )
    op.create_index(
        op.f("ix_certificate_batches_template_id"),
        "certificate_batches",
        ["template_id"],
        unique=False,
    )
    op.create_table(
        "form_fields",
        sa.Column("form_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "short_text",
                "long_text",
                "number",
                "email",
                "phone",
                "date",
                "single_choice",
                "multi_choice",
                "yes_no",
                name="form_field_type",
            ),
            nullable=False,
        ),
        sa.Column("required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("help_text", sa.Text(), server_default="", nullable=False),
        sa.Column(
            "options",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("hidden", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["form_id"],
            ["registration_forms.id"],
            name=op.f("fk_form_fields_form_id_registration_forms"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_form_fields")),
        sa.UniqueConstraint("form_id", "key", name=op.f("uq_form_fields_form_id_key")),
    )
    op.create_table(
        "placeholders",
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column("tag", sa.String(length=100), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("x", sa.Double(), nullable=False),
        sa.Column("y", sa.Double(), nullable=False),
        sa.Column("w", sa.Double(), nullable=False),
        sa.Column("h", sa.Double(), nullable=False),
        sa.Column("font_name", sa.String(length=100), nullable=False),
        sa.Column("font_size", sa.Double(), nullable=False),
        sa.Column(
            "align",
            sa.Enum("left", "center", "right", name="placeholder_align"),
            server_default="center",
            nullable=False,
        ),
        sa.Column(
            "source",
            sa.Enum("detected", "manual", name="placeholder_source"),
            server_default="manual",
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["certificate_templates.id"],
            name=op.f("fk_placeholders_template_id_certificate_templates"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_placeholders")),
    )
    op.create_index(
        op.f("ix_placeholders_template_id"), "placeholders", ["template_id"], unique=False
    )
    op.create_table(
        "qr_areas",
        sa.Column("poster_id", sa.Uuid(), nullable=False),
        sa.Column("x", sa.Integer(), nullable=False),
        sa.Column("y", sa.Integer(), nullable=False),
        sa.Column("w", sa.Integer(), nullable=False),
        sa.Column("h", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["poster_id"],
            ["posters.id"],
            name=op.f("fk_qr_areas_poster_id_posters"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_qr_areas")),
        sa.UniqueConstraint("poster_id", name=op.f("uq_qr_areas_poster_id")),
    )
    op.create_table(
        "certificates",
        sa.Column("public_id", sa.String(length=20), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("registration_id", sa.Uuid(), nullable=False),
        sa.Column("batch_id", sa.Uuid(), nullable=True),
        sa.Column("pdf_file_key", sa.String(length=500), nullable=False),
        sa.Column("display", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "status",
            sa.Enum("valid", "superseded", "revoked", name="certificate_status"),
            server_default="valid",
            nullable=False,
        ),
        sa.Column("superseded_by", sa.Uuid(), nullable=True),
        sa.Column("revoked_reason", sa.Text(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "issued_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["certificate_batches.id"],
            name=op.f("fk_certificates_batch_id_certificate_batches"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name=op.f("fk_certificates_event_id_events"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["registration_id"],
            ["registrations.id"],
            name=op.f("fk_certificates_registration_id_registrations"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["students.id"],
            name=op.f("fk_certificates_student_id_students"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["superseded_by"],
            ["certificates.id"],
            name=op.f("fk_certificates_superseded_by_certificates"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_certificates")),
        sa.UniqueConstraint("public_id", name=op.f("uq_certificates_public_id")),
    )
    op.create_index(op.f("ix_certificates_batch_id"), "certificates", ["batch_id"], unique=False)
    op.create_index(op.f("ix_certificates_event_id"), "certificates", ["event_id"], unique=False)
    op.create_index(
        op.f("ix_certificates_registration_id"), "certificates", ["registration_id"], unique=False
    )
    op.create_index(
        op.f("ix_certificates_student_id"), "certificates", ["student_id"], unique=False
    )
    op.create_table(
        "certificate_batch_items",
        sa.Column("batch_id", sa.Uuid(), nullable=False),
        sa.Column("registration_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "generated", "failed", name="certificate_batch_item_status"),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("certificate_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["certificate_batches.id"],
            name=op.f("fk_certificate_batch_items_batch_id_certificate_batches"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["certificate_id"],
            ["certificates.id"],
            name=op.f("fk_certificate_batch_items_certificate_id_certificates"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["registration_id"],
            ["registrations.id"],
            name=op.f("fk_certificate_batch_items_registration_id_registrations"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_certificate_batch_items")),
        sa.UniqueConstraint(
            "batch_id",
            "registration_id",
            name=op.f("uq_certificate_batch_items_batch_id_registration_id"),
        ),
    )
    op.create_index(
        op.f("ix_certificate_batch_items_certificate_id"),
        "certificate_batch_items",
        ["certificate_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_certificate_batch_items_registration_id"),
        "certificate_batch_items",
        ["registration_id"],
        unique=False,
    )
    op.create_table(
        "certificate_notifications",
        sa.Column("certificate_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "sent", "failed", "bounced", name="certificate_notification_status"),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["certificate_id"],
            ["certificates.id"],
            name=op.f("fk_certificate_notifications_certificate_id_certificates"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_certificate_notifications")),
        sa.UniqueConstraint(
            "certificate_id", name=op.f("uq_certificate_notifications_certificate_id")
        ),
    )
    op.create_index(
        op.f("ix_certificate_notifications_provider_message_id"),
        "certificate_notifications",
        ["provider_message_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_certificate_notifications_provider_message_id"),
        table_name="certificate_notifications",
    )
    op.drop_table("certificate_notifications")
    op.drop_index(
        op.f("ix_certificate_batch_items_registration_id"), table_name="certificate_batch_items"
    )
    op.drop_index(
        op.f("ix_certificate_batch_items_certificate_id"), table_name="certificate_batch_items"
    )
    op.drop_table("certificate_batch_items")
    op.drop_index(op.f("ix_certificates_student_id"), table_name="certificates")
    op.drop_index(op.f("ix_certificates_registration_id"), table_name="certificates")
    op.drop_index(op.f("ix_certificates_event_id"), table_name="certificates")
    op.drop_index(op.f("ix_certificates_batch_id"), table_name="certificates")
    op.drop_table("certificates")
    op.drop_table("qr_areas")
    op.drop_index(op.f("ix_placeholders_template_id"), table_name="placeholders")
    op.drop_table("placeholders")
    op.drop_table("form_fields")
    op.drop_index(op.f("ix_certificate_batches_template_id"), table_name="certificate_batches")
    op.drop_index(op.f("ix_certificate_batches_event_id"), table_name="certificate_batches")
    op.drop_table("certificate_batches")
    op.drop_table("attendance")
    op.drop_index(op.f("ix_registrations_student_id"), table_name="registrations")
    op.drop_table("registrations")
    op.drop_table("registration_forms")
    op.drop_index(op.f("ix_posters_event_id"), table_name="posters")
    op.drop_table("posters")
    op.drop_index(op.f("ix_exports_event_id"), table_name="exports")
    op.drop_table("exports")
    op.drop_index(op.f("ix_eligibility_rules_event_id"), table_name="eligibility_rules")
    op.drop_table("eligibility_rules")
    op.drop_index(op.f("ix_certificate_templates_event_id"), table_name="certificate_templates")
    op.drop_table("certificate_templates")
    op.drop_index(op.f("ix_events_club_id"), table_name="events")
    op.drop_table("events")
    for name in ENUM_TYPES:
        sa.Enum(name=name).drop(op.get_bind(), checkfirst=True)
