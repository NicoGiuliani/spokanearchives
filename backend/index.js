import express from "express";
import { PORT } from './config.js';
import path from 'path';
import pool from "./db/connection.js";
import * as url from 'url';

const app = express();
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/node_modules', express.static('node_modules'));
app.set("views", path.join(__dirname, 'views'));
app.set("view engine", "pug");

app.listen(PORT, () => {
  console.log(`App is listening on port: ${PORT}`);
});

app.get('/', async (request, response) => {
  response.render('home');
});

app.get('/search', async (request, response) => {
  const keyword = request.query.query;
  console.log(keyword);
  const sqlQuery = `SELECT * FROM spokane.buildings WHERE name LIKE '%${keyword}%';`
  console.log(sqlQuery);
  try {
    pool.query(sqlQuery, (error, result) => {
      if (error) {
        console.log(error);
      }
      response.render('search', { search_results: result });
    });
  } catch (error) {
    console.log(error);
  }
});

app.get('/profile/:buildingName', async (request, response) => {
  const buildingName = request.params['buildingName'];
  const buildingQuery = `
    SELECT buildings.id, name, year_built, year_destroyed, address, 
    address_description, description, maps_link
    FROM spokane.buildings WHERE name = ?;`
  const resourceQuery = `
    SELECT url, caption, image_index, year_taken FROM spokane.resources WHERE building = ?;`

  const buildingResult = await new Promise((resolve, reject) => {
    pool.query(buildingQuery, [buildingName], (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result[0]);
      }
    });
  })   
  
  const resourceResult = await new Promise((resolve, reject) => {
    pool.query(resourceQuery, [buildingName], (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  })  
  
  response.render("profile", { building: buildingResult, images: resourceResult });

});
  
app.get('/buildings/:column?/:method?', async (request, response) => {
  const column = request.params['column'] ? request.params['column'] : null;
  const method = request.params['method'] ? request.params['method'] : null;
  let sqlQuery;
  
  if (column) {
    switch (column) {
      case ("sortedByName"):
        if (method === "z-a") {
          sqlQuery = `SELECT * FROM buildings ORDER BY name DESC;`
        } else {
          sqlQuery = `SELECT * FROM buildings ORDER BY name;`
        }
        break;
      case ("sortedByYearBuilt"):
        if (method === "most-recent") {
          sqlQuery = `SELECT * FROM buildings ORDER BY year_built DESC;`
        } else {
          sqlQuery = `SELECT * FROM buildings ORDER BY year_built;`
        }
        break;
      case ("sortedByYearDestroyed"):
        if (method === "most-recent") {
          sqlQuery = `SELECT * FROM buildings ORDER BY year_destroyed DESC;`
        } else {
          sqlQuery = `
            SELECT * FROM buildings
            ORDER BY
              CASE
                WHEN year_destroyed IS NULL THEN 1
                    ELSE 0 
              END,
            year_destroyed ASC;`
        }
        break;
      case ("stillStanding"):
        sqlQuery = `SELECT * FROM buildings WHERE year_destroyed IS NULL ORDER BY name;`
        break;
      default:
        break;
    }
  } else {
    sqlQuery = `SELECT * FROM buildings ORDER BY name;`
  }

  const result = await new Promise((resolve, reject) => {
    pool.query(sqlQuery, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  })   

  return response.render("buildings", {buildings: result});
});

app.get('/buildings/sortByYearBuilt', async (request, response) => {
  const sqlQuery = `SELECT * FROM buildings ORDER BY year_built;`

  const result = await new Promise((resolve, reject) => {
    pool.query(sqlQuery, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  })   

  return response.render("buildings", {buildings: result});
});


app.post('/buildings', async (request, response) => {
  try {
    if (
      !request.body.name ||
      !request.body.year_built
    ) {
      return response.status(400).send({
        message: "Send all required fields"
      });
    } 
    const building = {
      name: request.body.name,
      year_built: request.body.year_built,
      year_destroyed: request.body.year_destroyed || null,
    }
    pool.query('INSERT INTO buildings (name, year_built, year_destroyed) VALUES (?, ?, ?)', 
    [building.name, building.year_built, building.year_destroyed], 
    (error, result) => {
      if (error) {
        return response.status(500).send({ message: error.message });
      } else {
        return response.status(201).send(building);
      }
    });
  } catch (error) {
    console.log(error.message);
    return response.status(500).send({ message: error.message });
  }
});

app.post('/resources', async (request, response) => {
  try {
    if (
      !request.body.building ||
      !request.body.url
    ) {
      return response.status(400).send({
        message: "Send all required fields"
      });
    } 
    const resource = {
      building: request.body.building,
      url: request.body.url,
    }
    pool.query('INSERT INTO resources (building, url) VALUES (?, ?)', 
    [resource.building, resource.url], 
    (error, result) => {
      if (error) {
        return response.status(500).send({ message: error.message });
      } else {
        return response.status(201).send(resource);
      }
    });
  } catch (error) {
    console.log(error.message);
    return response.status(500).send({ message: error.message });
  }
});
