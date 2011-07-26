from django.db import models


class Name(models.Model):
    name = models.CharField("DUNS-linked name", max_length=255,
                            blank=False, null=False, unique=True)
    def __repr__(self):
        return "<Name(%s)>" % self.name


class DUNS(models.Model):
    class Meta:
        verbose_name = 'DUNS Number'

    number = models.CharField("DUNS Number", max_length=13,
                              blank=False, null=False, unique=True)
    def __repr__(self):
        return "<Duns(%s)>" % self.number


class FAADS(models.Model):
    class Meta:
        verbose_name = 'FAADS Record'

    data_commons_id = models.IntegerField("Record ID",
                                          blank=False, null=False, 
                                          primary_key=True)
    unique_transaction_id = models.CharField("Unique Transaction ID", 
                                             max_length="32", 
                                             blank=False, null=False)
    duns = models.ForeignKey(DUNS, related_name='faads', blank=False, null=False)
    recipient_name = models.ForeignKey(Name, related_name='faads', blank=False, null=False)
    fiscal_year = models.IntegerField("Fiscal year", blank=False, null=False)



class FPDS(models.Model):
    class Meta:
        verbose_name = 'FPDS Record'

    unique_transaction_id = models.CharField('unique_transaction_id', max_length=255, blank=False, null=False)
    data_commons_id = models.IntegerField('data commons id', blank=False, null=False, primary_key=True)
    duns = models.ForeignKey(DUNS, related_name='fpds', blank=False, null=True)
    duns_parent = models.ForeignKey(DUNS, related_name='fpds_parent', blank=False, null=True)
    company_name = models.ForeignKey(Name, related_name='fpds', blank=False, null=False)
    fiscal_year = models.IntegerField("Fiscal year", blank=False, null=False)

