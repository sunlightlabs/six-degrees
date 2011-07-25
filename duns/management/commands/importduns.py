import duns.faads
import duns.fpds
from django.core.management.base import NoArgsCommand
from optparse import make_option
import settings
import psycopg2

class Command(NoArgsCommand):
    help = "Import DUNS data."
    option_list = NoArgsCommand.option_list + (
        make_option('--faads-only', action='store_true',
                    dest='faads_only', default=False,
                    help="Limit import to FAADS data."),
        make_option('--fpds-only', action='store_true',
                    dest='fpds_only', default=False,
                    help="Limit import to FPDS data."),
        make_option('--max-records',
                    dest='max_records', default=None,
                    help="Maximum number of source records to import data from.")
    )

    def handle_noargs(self, faads_only, fpds_only, max_records, *args, **options):
        if faads_only and fpds_only:
            raise Exception("--faads-only and --fpds-only are mutually exclusive.")

#        db_uri = "{host}:{name}:{user}:{password}".format(**settings.DATACOMMONS_DB)
#        src_db = pgdb.connect(db_uri,
#                              host=settings.DATACOMMONS_DB['host'])
        src_db = psycopg2.connect(**settings.DATACOMMONS_DB)

        if not fpds_only:
            faads_importer = duns.faads.Importer(src_db)
            if max_records:
                faads_importer.step(max_records)
            else:
                faads_importer.run(stepsize=5000)

        if not faads_only:
            fpds_importer = duns.fpds.Importer(src_db)
            if max_records:
                fpds_importer.step(max_records)
            else:
                fpds_importer.run(stepsize=5000)


