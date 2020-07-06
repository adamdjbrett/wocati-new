---
title: Image Gallery Archive
layout: default
permalink: /image-gallery-archive/
---
<figure class="third half">
 {% for file in site.static_files %}
 {% if file.path contains "wp-content/" %}
 {% if file.extname == '.jpg' or file.extname == '.jpeg' or file.extname == '.JPG' or file.extname == '.JPEG' %}
 {% assign filenameparts = file.path | split: "/" %}{% assign filename = filenameparts | last | replace: file.extname,"" %}
     <a href="{{ file.path | relative_url }}" title="{{ filename }}" >
         <img src="{{ file.path | relative_url }}" alt="{{ filename }}">
     </a>
   {% else %}
     <img src="{{ file.path | relative_url }}" alt="{{ filename }}">
    {% endif %}
    {% endif %}
    {% endfor %}
</figure>
