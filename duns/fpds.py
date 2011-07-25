"""Imports data from FPDS table -- based on Data Commons schema"""

from contextlib import closing
from django.db.models import Max
from duns.models import FPDS, DUNS, Name
from psycopg2.extras import DictCursor


class Importer(object):
    def __init__(self, dbconn):
        self.dbconn = dbconn
        self.checkpoint = None

    def record(self, dbrow):
        """Transforms each raw table row into data model objects."""
        raw_vndr_name = dbrow['vendorname'].strip()
        raw_duns = dbrow['dunsnumber'].strip()
        raw_parent_duns = dbrow['parentdunsnumber'].strip()

        if raw_vndr_name != '' and raw_duns != '':
            (vndr_name, created) = Name.objects.get_or_create(name=raw_vndr_name)
            if created:
                vndr_name.save()

            (duns, created) = DUNS.objects.get_or_create(number=raw_duns)
            if created:
                duns.save()

            if raw_parent_duns == '':
                parent_duns = None
            else:
                (parent_duns, created) = DUNS.objects.get_or_create(number=raw_parent_duns)
                if created:
                    parent_duns.save()

            fpds = FPDS(data_commons_id=dbrow['id'])
            fpds.unique_transaction_id = dbrow['unique_transaction_id']
            fpds.duns = duns
            fpds.duns_parent = parent_duns
            fpds.company_name = vndr_name
            fpds.fiscal_year = dbrow['fiscal_year']
            fpds.save()

            data_commons_id = int(dbrow['id'])
            if data_commons_id > self.checkpoint:
                self.checkpoint = data_commons_id

    def step(self, nrows):
        """Imports `nrows` new rows."""
        if self.checkpoint is None:
            self.checkpoint = FPDS.objects.aggregate(Max('data_commons_id')).get('data_commons_id__max') or 0

        sql = " ".join(("SELECT unique_transaction_id, id,",
                        "       dunsnumber, parentdunsnumber,",
                        "       vendorname, fiscal_year",
                        "FROM {table}",
                        "WHERE id > %s",
                        "LIMIT %s")).format(table='contracts_contract')

        with closing(self.dbconn.cursor(cursor_factory=DictCursor)) as cur:
            cur.execute(sql, (self.checkpoint, nrows))
            rows = cur.fetchall()
            for row in rows:
                self.record(row)

    def run(self, stepsize):
        """Imports all new records. Reports progress after every `stepsize` rows."""
        while True:
            self.step(stepsize)
        
