import os
from fitparse import FitFile
from django.conf import settings
from django.shortcuts import render
from datetime import datetime, timedelta
import json
from datetime import timezone as dt_timezone
from django.utils import timezone
from django.shortcuts import render, get_object_or_404
from django.contrib import messages
from ..models import Ride
"""
改进的垂直速度和坡度计算（仅在设备不提供数据时使用）
"""



def parse_fit_file(file_path):
    """解析FIT文件，获取完整数据"""
    try:
        fitfile = FitFile(file_path)
    except Exception as e:
        print(f"❌ 无法打开FIT文件: {e}")
        return {}

    points = []
    session_data = {}
    altitudes = []
    temperatures = []


     # 转为 Django 当前时区
    # 读取 session 和 record 数据
    for record in fitfile.get_messages():
        if record.name == 'session':
            for field in record:
                session_data[field.name] = field.value

        elif record.name == 'record':
            data_point = {field.name: field.value for field in record}

            if data_point.get('position_lat') is not None and data_point.get('position_long') is not None:
                lat = data_point['position_lat'] * (180 / 2 ** 31)
                lon = data_point['position_long'] * (180 / 2 ** 31)
                ele = data_point.get('enhanced_altitude')
                temp = data_point.get('temperature')
                distance = data_point.get('distance')
                if ele is not None:
                    altitudes.append(ele)
                if temp is not None:
                    temperatures.append(temp)
                ts = data_point.get('timestamp')
                if ts:
                    if ts.tzinfo is None:  # naive datetime
                        ts = ts.replace(tzinfo=dt_timezone.utc)  # 标记为 UTC
                    ts = timezone.localtime(ts)
                points.append({
                    'distance': distance,
                    'lat': lat,
                    'lon': lon,
                    'ele': ele,
                    'time': ts.strftime('%Y-%m-%d %H:%M:%S') if ts else None ,
                    'speed': data_point.get('enhanced_speed')*3.6 if data_point.get('enhanced_speed') else 0,  # m/s -> km/h
                    'heart_rate': data_point.get('heart_rate'),
                    'cadence': data_point.get('cadence'),
                    'power': data_point.get('power'),
                    'temperature': temp,
                })

    if not points:
        print("⚠️ 没有找到GPS数据点")
        return {}

    # 辅助函数: 格式化秒数为 HH:MM:SS
    def format_duration(seconds):
        if not seconds:
            return "00:00:00"
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"

    # 使用 session 数据
    total_distance = round((session_data.get('total_distance', 0) or 0) / 1000, 2)
    total_elapsed_time = session_data.get('total_elapsed_time', 0) or 0
    total_timer_time = session_data.get('total_timer_time', 0) or 0
    total_ascent = session_data.get('total_ascent', 0) or 0
    total_descent = session_data.get('total_descent', 0) or 0
    avg_speed = (session_data.get('avg_speed', 0) or 0) * 3.6
    max_speed = (session_data.get('max_speed', 0) or 0) * 3.6
    avg_heart_rate = session_data.get('avg_heart_rate')
    max_heart_rate = session_data.get('max_heart_rate')
    avg_cadence = session_data.get('avg_cadence')
    avg_power = session_data.get('avg_power')
    total_calories = session_data.get('total_calories')
    start_time = session_data.get('start_time')
    end_time = session_data.get('timestamp')  # 结束时间

    if start_time:
        start_time = start_time.replace(tzinfo=dt_timezone.utc)
    end_time = session_data.get('timestamp')  # 结束时间
    if end_time:
        end_time = end_time.replace(tzinfo=dt_timezone.utc)
    # 坡度和垂直速度
    avg_ascent_speed = session_data.get('avg_pos_vertical_speed')
    max_ascent_speed = session_data.get('max_pos_vertical_speed')
    avg_descent_speed = session_data.get('avg_neg_vertical_speed')
    max_descent_speed = session_data.get('max_neg_vertical_speed')
    avg_up_grade = session_data.get('avg_pos_grade')
    max_up_grade = session_data.get('max_pos_grade')
    avg_down_grade = session_data.get('avg_neg_grade')
    max_down_grade = session_data.get('max_neg_grade')

    # 海拔与温度
    min_altitude = session_data.get('enhanced_min_altitude') or (min(altitudes) if altitudes else 0)
    avg_altitude = session_data.get('enhanced_avg_altitude') or (sum(altitudes)/len(altitudes) if altitudes else 0)
    max_altitude = session_data.get('enhanced_max_altitude') or (max(altitudes) if altitudes else 0)
    avg_temperature = session_data.get('avg_temperature') or (sum(temperatures)/len(temperatures) if temperatures else None)
    max_temperature = session_data.get('max_temperature') or (max(temperatures) if temperatures else None)

    return {
        'points': points,
        'points_json': json.dumps(points),
        'total_distance': total_distance,
        'average_speed': round(avg_speed, 1),
        'max_speed': round(max_speed, 1),
        'total_elapsed_time': int(total_elapsed_time),
        'total_elapsed_time_fmt': format_duration(total_elapsed_time),
        'total_timer_time': int(total_timer_time),
        'total_timer_time_fmt': format_duration(total_timer_time),
        'start_time': start_time if start_time else 'N/A',
        'end_time': end_time if end_time else 'N/A',
        'total_ascent': int(round(total_ascent, 0)),
        'total_descent': int(round(abs(total_descent), 0)),
        'avg_ascent_speed': avg_ascent_speed,
        'max_ascent_speed': max_ascent_speed,
        'avg_descent_speed': avg_descent_speed,
        'max_descent_speed': max_descent_speed,
        'avg_up_grade': avg_up_grade,
        'max_up_grade': max_up_grade,
        'avg_down_grade': avg_down_grade,
        'max_down_grade': max_down_grade,
        'min_altitude': round(min_altitude, 0),
        'avg_altitude': round(avg_altitude, 0),
        'max_altitude': round(max_altitude, 0),
        'avg_temperature': avg_temperature,
        'max_temperature': max_temperature,
        'avg_heart_rate': avg_heart_rate,
        'max_heart_rate': max_heart_rate,
        'avg_cadence': avg_cadence,
        'avg_power': avg_power,
        'total_calories': total_calories,
        'has_heart_rate': any(p.get('heart_rate') for p in points),
        'has_cadence': any(p.get('cadence') for p in points),
        'has_power': any(p.get('power') for p in points),
        'has_temperature': bool(temperatures),
    }


def parse_gpx_file(file_path):
    """保留GPX解析支持"""
    import gpxpy

    with open(file_path, 'r', encoding='utf-8') as f:
        gpx = gpxpy.parse(f)

    points = []
    total_distance = 0
    elevation_gain = 0
    total_time = 0
    altitudes = []

    for track in gpx.tracks:
        for segment in track.segments:
            seg_points = segment.points
            for pt in seg_points:
                point = {
                    'lat': pt.latitude,
                    'lon': pt.longitude,
                    'ele': pt.elevation,
                    'time': pt.time.isoformat() if pt.time else None,
                    'speed': 0,
                }
                points.append(point)
                if pt.elevation:
                    altitudes.append(pt.elevation)

            # 累计爬升
            elevation_gain += sum(
                max(0, seg_points[i + 1].elevation - seg_points[i].elevation)
                for i in range(len(seg_points) - 1)
                if seg_points[i + 1].elevation and seg_points[i].elevation
            )

            # 总时间
            if len(seg_points) >= 2 and seg_points[0].time and seg_points[-1].time:
                total_time += (seg_points[-1].time - seg_points[0].time).total_seconds()

            # 总距离
            total_distance += segment.length_2d() / 1000  # km

    average_speed = round(total_distance / (total_time / 3600) if total_time > 0 else 0, 2)

    return {
        'points': points,
        'points_json': json.dumps(points),
        'total_distance': round(total_distance, 2),
        'total_elapsed_time': int(total_time),
        'total_elapsed_time_fmt': f"{int(total_time // 3600):02d}:{int((total_time % 3600) // 60):02d}:{int(total_time % 60):02d}",

        'average_speed': average_speed,
        'total_ascent': round(elevation_gain, 0),
        'min_altitude': round(min(altitudes), 0) if altitudes else 0,
        'avg_altitude': round(sum(altitudes) / len(altitudes), 0) if altitudes else 0,
        'max_altitude': round(max(altitudes), 0) if altitudes else 0,
    }


def ride_display(request, id):
    # 1. 根据 ID 获取数据库记录
    ride = get_object_or_404(Ride, pk=id)



    if ride.data_file:
        # ❌ 错误写法: selected_file = ride.data_file.filename
        # ✅ 正确写法: 使用 .name 获取文件路径字符串
        selected_file = ride.data_file.name

        # 获取绝对路径用于读取
        file_path = ride.data_file.path

        if selected_file.lower().endswith('.fit'):
            ride_data = parse_fit_file(file_path)
        elif selected_file.lower().endswith('.gpx'):
            ride_data = parse_gpx_file(file_path)
        else:
            ride_data = {}
    else:
        ride_data = {}

    return render(request, 'display.html', {
        'ride': ride,  # 用于显示标题、下载链接
        'ride_data': ride_data,  # 用于显示地图、图表数据
    })