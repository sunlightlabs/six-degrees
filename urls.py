from django.conf.urls.defaults import patterns, include, url
from django.views.generic.simple import direct_to_template
from django.conf import settings
# Uncomment the next two lines to enable the admin:
# from django.contrib import admin
# admin.autodiscover()

urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'website.views.home', name='home'),
    # url(r'^website/', include('website.foo.urls')),

    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
    # url(r'^admin/', include(admin.site.urls)),
    url(r'^$', direct_to_template, {'template': 'index.html'}, 
        name='index'),
    url(r'^existing-identifiers/$', direct_to_template, {'template': 'existing_identifiers.html'}, 
        name='existing-identifiers'),
    url(r'^singapore-uen/$', direct_to_template, {'template': 'singapore_uen.html'}, 
        name='singapore-uen'),
    url(r'^resources/$', direct_to_template, {'template': 'resources.html'}, 
        name='resources'),
    url(r'^contact', include('contactform.urls')),
    url(r'^duns[/]?', include('duns.urls')),
)

urlpatterns += patterns('',
    url(r'^media/(?P<path>.*)$', 'django.views.static.serve', {'document_root': settings.MEDIA_ROOT}),
)

if hasattr(settings, 'URL_PREFIX') and settings.URL_PREFIX:
    urlpatterns = patterns('', url('^%s/' % settings.URL_PREFIX, include(urlpatterns)))

