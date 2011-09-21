from django.conf.urls.defaults import patterns, url

urlpatterns = patterns('contactform.views',
    url(r'^sent$', 'sent', name='contactform-sent'),
    url(r'^$', 'form', name='contactform'),
)

