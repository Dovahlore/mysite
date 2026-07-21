from django.shortcuts import render, HttpResponse, redirect
import dovahbase.models as models
def main(request):

    return render(request, "main.html")