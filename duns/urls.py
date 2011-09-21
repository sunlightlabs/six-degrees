from django.conf.urls.defaults import patterns, url
from django.views.generic.simple import direct_to_template

urlpatterns = patterns('duns.views',
    url(r'^$', 'index'),
    url(r'^whatisthis$', direct_to_template, {'template': 'whatisthis.html'}),
    url(r'^autocomplete$', 'autocomplete', 
        name='duns-autocomplete'),
    url(r'^details/(?P<duns_number>[0-9]+)\.(?P<fmt>html|json)$', 'duns_details', 
        name='duns-dunsdetails'),
    url(r'^details/(?P<entity_name>.+)\.(?P<fmt>html|json)$', 'name_details', 
        name='duns-namedetails'),
    url(r'^(?P<duns_number>[0-9]+)$', 'lookup_by_duns_number', 
        name='duns-dunslookup'),
    url(r'^(?P<entity_name>.+)$', 'lookup_by_name', 
        name='duns-namelookup'),
)

