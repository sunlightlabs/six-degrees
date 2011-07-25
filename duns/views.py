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
from utils import flattened, parseint


class USASpendingAPI(object):
    @staticmethod
    def faads(params):
        response = urlopen('http://usaspending.gov/faads/faads.php',
                           data=urlencode(params))
        if response.code == 200:
            text = response.read()
            if text is None or text == '':
                return None
            else:
                return lxml.etree.fromstring(text)
        else:
            raise Exception("Failed to retrieved data from USASpending: %s" % response.code) 
            

def faads_search_by_name(entity_name):
    result_tree = USASpendingAPI.faads([('detail', 'l'), ('recipient_name', entity_name.upper())])
    if result_tree is None:
        return None
    else:
        duns_elements = result_tree.xpath('/usaspendingSearchResults/data/record/duns_no')
        duns_list = list(set(flattened([e.text.split(',')
                                        for e in duns_elements
                                        if e.text is not None])))

        duns_list = [duns_str 
                     for duns_str in duns_list
                     if parseint(duns_str, 0) != 0]
        return duns_list


def faads_search_by_duns(duns_number):
    result_tree = USASpendingAPI.faads([('detail', 'l'), ('duns_number', duns_number)])
    if result_tree is None:
        return None
    else:
        name_elements = result_tree.xpath('/usaspendingSearchResults/data/record/recipient_name')
        name_list = list(set(flattened([e.text.upper() for e in name_elements])))
        return name_list

    
def lookup_by_name(request, entity_name):
    cache_key = quote(entity_name.upper())
    duns_list = cache.get(cache_key)
    print "%s cache %s" % (cache_key, "hit" if duns_list else "miss")
    if duns_list is None:
        duns_list = faads_search_by_name(entity_name)
        if duns_list is None:
            duns_list = []
        else:
            cache.set(cache_key, duns_list)
    json_string = json.dumps(duns_list)
    return HttpResponse(json_string, mimetype='application/json')


def lookup_by_duns_number(request, duns_number):
    cache_key = quote(duns_number)
    name_list = cache.get(cache_key)
    print "%s cache %s" % (cache_key, "hit" if name_list else "miss")
    if name_list is None:
        name_list = faads_search_by_duns(duns_number)
        if name_list is None:
            name_list = []
        else:
            cache.set(cache_key, name_list)
    json_string = json.dumps(name_list)
    return HttpResponse(json_string, mimetype='application/json')
