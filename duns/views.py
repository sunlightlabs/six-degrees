import lxml.etree
from urllib import urlencode, quote
from urllib2 import urlopen
try:
    import json
except ImportError:
    import simplejson as json
from operator import itemgetter
from django.http import HttpResponse, HttpResponseServerError
from django.shortcuts import render, render_to_response, redirect, get_object_or_404
from django.views.decorators.cache import cache_page
from django.core.cache import cache
from duns.models import FPDS, FAADS, DUNS, Name
from utils import parseint

NameBlacklist = [
    'NO DATA FROM D AND B'
]

def index(request):
    contract_count = FPDS.objects.count()
    grant_count = FAADS.objects.count()
    name_count = Name.objects.count()
    duns_count = DUNS.objects.count()

    return render_to_response('duns-index.html',
                              { 'contract_count': contract_count,
                                'grant_count': grant_count,
                                'name_count': name_count,
                                'duns_count': duns_count })

def search_by_name(entity_name):
    if entity_name.upper() in NameBlacklist:
        return None

    try:
        nm = Name.objects.get(name=entity_name)
        grants = nm.faads.all()
        contracts = nm.fpds.all()
        duns_numbers = set( [g.duns.number for g in grants]
                          + [c.duns.number for c in contracts] )
        return [n for n in duns_numbers
                  if parseint(n, 0) != 0]
    except Name.DoesNotExist:
        return None


def search_by_duns(duns_number):
    try:
        duns = DUNS.objects.get(number=duns_number)
        grants = duns.faads.all()
        contracts = duns.fpds.all()
        names = set( [g.recipient_name.name.upper() for g in grants] 
                   + [c.company_name.name.upper() for c in contracts] )
        return list(names)
    except DUNS.DoesNotExist:
        return None


def lookup_by_name(request, entity_name):
    cache_key = quote(entity_name.upper())
    duns_list = cache.get(cache_key)
    print "%s cache %s" % (cache_key, "hit" if duns_list else "miss")
    if duns_list is None:
        duns_list = search_by_name(entity_name)
        if duns_list is None:
            duns_list = []
        else:
            cache.set(cache_key, duns_list)
    json_string = json.dumps({'querytype': 'name',
                              'query': entity_name,
                              'results': duns_list})
    return HttpResponse(json_string, mimetype='application/json')


def lookup_by_duns_number(request, duns_number):
    cache_key = quote(duns_number)
    name_list = cache.get(cache_key)
    print "%s cache %s" % (cache_key, "hit" if name_list else "miss")
    if name_list is None:
        name_list = search_by_duns(duns_number)
        if name_list is None:
            name_list = []
        else:
            cache.set(cache_key, name_list)
    json_string = json.dumps({'querytype': 'duns',
                              'query': duns_number,
                              'results': name_list})
    return HttpResponse(json_string, mimetype='application/json')
