"""Imports data from FAADS table -- based on Data Commons schema"""

from contextlib import closing
from django.db.models import Max
from duns.models import FAADS, DUNS, Name
from utils import join_field_list
from psycopg2.extras import DictCursor


class Importer(object):
    def __init__(self, dbconn):
        self.dbconn = dbconn
        self.checkpoint = None

    def record(self, dbrow):
        """Transforms each raw table row into data model objects."""
        raw_rcpt_name = dbrow['recipient_name'].strip()
        raw_duns = dbrow['duns_no'].strip()

        if raw_rcpt_name != '' and raw_duns != '':
            rcpt_name = Name(raw_rcpt_name)
            rcpt_name.save()

            duns = DUNS(raw_duns)
            duns.save()

            faads = FAADS(data_commons_id=dbrow['id'])
            faads.unique_transaction_id = dbrow['unique_transaction_id']
            faads.duns = duns
            faads.recipient_name = rcpt_name
            faads.fiscal_year = dbrow['fiscal_year']
            faads.save()

            data_commons_id = int(dbrow['id'])
            if data_commons_id > self.checkpoint:
                self.checkpoint = data_commons_id

    def step(self, nrows):
        """Imports `nrows` new rows."""
        if self.checkpoint is None:
            self.checkpoint = FAADS.objects.aggregate(Max('data_commons_id')).get('data_commons_id__max') or 0

        sql = " ".join(("SELECT unique_transaction_id, id,",
                        "       duns_no, recipient_name, fiscal_year",
                        "FROM {table}",
                        "WHERE id > %s",
                        "LIMIT %s")).format(table='grants_grant')

        with closing(self.dbconn.cursor(cursor_factory=DictCursor)) as cur:
            cur.execute(sql, (self.checkpoint, nrows))
            rows = cur.fetchall()
            for row in rows:
                self.record(row)

    def run(self, stepsize):
        """Imports all new records. Reports progress after every `stepsize` rows."""
        while True:
            self.step(stepsize)
        
