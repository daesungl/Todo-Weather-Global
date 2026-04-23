import React, {useState} from 'react';
import cityData from '../assets/db/kor_cities.json';


export default function CitySearch (cityName) {

    const cities = cityData;

    var retCities = new Array();
    var tmpObj;

    cities.map((val,i) => {
        tmpObj = new Object();

        tmpObj.id = val.dist_code;
        tmpObj.title = val.name1 + ' ' + val.name2 + ' ' + val.name3;
        tmpObj.rs_x = val.rs_x;
        tmpObj.rs_y = val.rs_y;
        tmpObj.longitude = val.longitude;
        tmpObj.latitude = val.latitude;

        retCities.push(tmpObj);
    }
    )

    return retCities;
}

