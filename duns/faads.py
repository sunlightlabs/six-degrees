"""Imports FAADS grant data."""


from duns.models import FAADS
from duns.importer import Importer


class FAADSImporter(Importer):
    def __init__(self, dbconn):
        Importer.__init__(self, 'grants_grant',
                          ('unique_transaction_id', 'id',
                           'duns_no', 'recipient_name', 'fiscal_year'),
                          FAADS, dbconn)

    def record(self, dbrow):
        """Transforms each raw table row into data model objects."""
        raw_rcpt_name = dbrow['recipient_name'].strip()
        raw_duns = dbrow['duns_no'].strip()

        if raw_rcpt_name != '' and raw_duns != '':
            rcpt_name = self._name(raw_rcpt_name)
            duns = self._duns(raw_duns)

            faads = FAADS(data_commons_id=dbrow['id'])
            faads.unique_transaction_id = dbrow['unique_transaction_id']
            faads.duns = duns
            faads.recipient_name = rcpt_name
            faads.fiscal_year = dbrow['fiscal_year']
            faads.save()
        
