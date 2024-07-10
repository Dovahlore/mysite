from django.shortcuts import render, HttpResponse, redirect
##test
from django.core.cache import cache
import pickle
class ss:
        def __init__(self):
            self.a=1
def test_cache(request):

    return render(request,"test.html")
