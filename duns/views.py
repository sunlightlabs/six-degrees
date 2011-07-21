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
from utils import flattened


class USASpendingAPI(object):
    @staticmethod
    def faads(params):
        response = urlopen('http://usaspending.gov/faads/faads.php',
                           data=urlencode(params))
        return lxml.etree.fromstring(response.read())

        
def lookup_by_name(request, entity_name):
    cache_key = quote(entity_name.upper())
    duns_list = cache.get(cache_key)
    print "%s cache %s" % (cache_key, "hit" if duns_list else "miss")
    if duns_list is None:
        result_tree = USASpendingAPI.faads([('detail', 'l'), ('recipient_name', entity_name.upper())])
        duns_elements = result_tree.xpath('/usaspendingSearchResults/data/record/duns_no')
        duns_list = list(set(flattened([e.text.split(',')
                                        for e in duns_elements
                                        if e.text is not None])))
        cache.set(cache_key, duns_list)
    json_string = json.dumps(duns_list)
    return HttpResponse(json_string, mimetype='application/json')


def lookup_by_duns_number(request, duns_number):
    cache_key = quote(duns_number)
    name_list = cache.get(cache_key)
    print "%s cache %s" % (cache_key, "hit" if name_list else "miss")
    if name_list is None:
        result_tree = USASpendingAPI.faads([('detail', 'l'), ('duns_number', duns_number)])
        name_elements = result_tree.xpath('/usaspendingSearchResults/data/record/recipient_name')
        name_list = list(set(flattened([e.text.upper() for e in name_elements])))
        cache.set(cache_key, name_list)
    json_string = json.dumps(name_list)
    return HttpResponse(json_string, mimetype='application/json')
