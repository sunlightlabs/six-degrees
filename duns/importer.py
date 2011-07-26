"""Base class for implementing Data Commons importers."""


from contextlib import closing
from django.db.models import Max
from duns.models import DUNS, Name
from psycopg2.extras import DictCursor
from GenericCache.GenericCache import GenericCache


class Importer(object):
    class Done(Exception):
        pass

    def __init__(self, src_table, src_fields, dst_model, dbconn):
        self.src_table = src_table
        self.src_fields = src_fields
        self.dst_model = dst_model
        self.dbconn = dbconn
        self.checkpoint = None
        self.duns_cache = GenericCache(maxsize=1024)
        self.name_cache = GenericCache(maxsize=1024)

    def _duns(self, duns_string):
        duns = self.duns_cache[duns_string]
        if duns is None:
            (duns, created) = DUNS.objects.get_or_create(number=duns_string)
            if created:
                duns.save()
        return duns

    def _name(self, name_string):
        name = self.name_cache[name_string]
        if name is None:
            (name, created) = Name.objects.get_or_create(name=name_string)
            if created:
                name.save()
        return name

    def step(self, nrows):
        """Imports `nrows` new rows."""
        if self.checkpoint is None:
            self.checkpoint = self.dst_model.objects.aggregate(Max('data_commons_id')).get('data_commons_id__max') or 0

        sql = " ".join(("SELECT {fields}",
                        "FROM {table}",
                        "WHERE id > %s",
                        "ORDER BY id ASC",
                        "LIMIT %s")).format(fields=", ".join(self.src_fields),
                                            table=self.src_table)

        with closing(self.dbconn.cursor(cursor_factory=DictCursor)) as cur:
            cur.execute(sql, (self.checkpoint, nrows))
            rows = cur.fetchall()
            if len(rows) == 0:
                raise Importer.Done()

            for row in rows:
                self.record(row)

                data_commons_id = int(row['id'])
                if data_commons_id > self.checkpoint:
                    self.checkpoint = data_commons_id

    def run(self, stepsize):
        """Imports all new records. Reports progress after every `stepsize` rows."""
        while True:
            self.step(stepsize)

