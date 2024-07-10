function like_add(csrf,element){
$.ajaxSetup({
    data: {
        csrfmiddlewaretoken:csrf,
    }
});

if(element.data("liked")=="0")
{
    $.ajax({
        type: 'post',
        url: "/s/like",
        data: {
            'id': element.attr('data-id'),
            },
        dataType: 'json',
        success: function(ret) {console.log(ret);
            element.attr('class', "fas fa-heart");
            element.css('color', "#f00");
            element.data("liked","1");
            var newlikes=Number(element.next().text())+1
            element.next().text(newlikes);
console.log(newlikes)
             }
        });

}
}