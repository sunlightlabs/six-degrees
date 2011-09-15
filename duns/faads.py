"""Imports FAADS grant data."""


from duns.models import FAADS
from duns.importer import Importer, strip_plus4


class FAADSImporter(Importer):
    def __init__(self, dbconn):
        Importer.__init__(self, 'grants_grant',
                          ('unique_transaction_id', 'id',
                           'cfda_program_num', 'cfda_program_title',
                           'obligation_action_date', 'federal_award_id', 'federal_award_mod',
                           'duns_conf_code', 'duns_no', 'recipient_name', 'fiscal_year'),
                          FAADS, dbconn)

    def record(self, dbrow):
        """Transforms each raw table row into data model objects."""
        raw_rcpt_name = strip_plus4(dbrow['recipient_name'].strip())
        raw_duns = dbrow['duns_no'][:9].strip()

        if raw_rcpt_name != '' and raw_duns != '':
            rcpt_name = self._name(raw_rcpt_name)
            duns = self._duns(raw_duns)

            faads = FAADS(data_commons_id=dbrow['id'])
            faads.unique_transaction_id = dbrow['unique_transaction_id']
            faads.duns = duns
            faads.recipient_name = rcpt_name
            faads.fiscal_year = dbrow['fiscal_year']
            faads.cfda_program_num = dbrow['cfda_program_num']
            faads.cfda_program_title = dbrow['cfda_program_title']
            faads.federal_award_id = dbrow['federal_award_id']
            faads.federal_award_mod = dbrow['federal_award_mod']
            faads.obligation_action_date = dbrow['obligation_action_date']
            faads.duns_conf_code = dbrow['duns_conf_code']
            faads.save()
        
