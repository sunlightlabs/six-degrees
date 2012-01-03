from django.template import RequestContext
from django.http import HttpResponseBadRequest, HttpResponseRedirect
from django.core.urlresolvers import reverse
from django.shortcuts import render_to_response
from django import forms
from django.core.mail import EmailMessage
import settings


class ContactForm(forms.Form):
    body = forms.CharField(max_length=15000, widget=forms.Textarea)
    email = forms.EmailField()
    name = forms.CharField(max_length=255)


def form(request):
    ctx = RequestContext(request)
    if request.META['REQUEST_METHOD'] == 'POST':
        return form_post(request.POST, ctx)
    elif request.META['REQUEST_METHOD'] == 'GET':
        form = ContactForm()
        ctx.update({'form': form})
        return render_to_response('contactform/form.html', ctx)
    else:
        return HttpResponseBadRequest()


def form_post(post, ctx):
    form = ContactForm(post)
    if not form.is_valid():
        ctx.update({'form': form})
        return render_to_response('contactform/form.html', ctx)

    (sent, error) = send_contact_email(post)
    if not sent:
        return render_to_response('contactform/sendfail.html', 
                                  {'error': error})

    return HttpResponseRedirect(reverse('contactform-sent'))


def send_contact_email(post):
    try:
        message = EmailMessage(subject='Contact from %s <%s>' % (post.get('name'), post.get('email')),
                               body=post.get('body'),
                               from_email=settings.POSTMARK_SENDER,
                               to=[settings.CONTACT_RECIPIENT])
        message.send()
        return (True, None)
    except Exception, e:
        return (False, str(e))


def sent(request):
    return render_to_response('contactform/sent.html')

