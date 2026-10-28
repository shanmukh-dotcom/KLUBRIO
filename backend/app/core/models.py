"""Import every module's models so `Base.metadata` is complete (used by Alembic)."""

from app.accounts import models as accounts_models  # noqa: F401
from app.certificates import models as certificates_models  # noqa: F401
from app.core.db import Base
from app.events import models as events_models  # noqa: F401
from app.exports import models as exports_models  # noqa: F401
from app.notifications import models as notifications_models  # noqa: F401
from app.posters import models as posters_models  # noqa: F401
from app.registrations import models as registrations_models  # noqa: F401

metadata = Base.metadata
