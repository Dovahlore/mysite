from django.shortcuts import render
from datetime import datetime
import dovahbase.models as models
# Create your views here.
def main(request):
    now = datetime.now()
    movies = models.movie.objects.filter(
        watch_date__year=now.year,
        watch_date__month=now.month
    ).order_by('-watch_date')
    mangas=models.manga.objects.filter(
        finish=False
    ).order_by('-created_at')
    episodes = models.episode.objects.filter(
        finish=False
    ).order_by('-created_at')
    return render(request, "base_main.html",{"movies":movies,"mangas":mangas,"episodes":episodes})


