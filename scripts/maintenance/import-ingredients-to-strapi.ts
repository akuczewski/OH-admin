import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from cms/.env BEFORE other imports
dotenv.config({ path: path.join(__dirname, '../.env') });

import { db } from '../src/lib/firebase';
import axios from 'axios';

const STRAPI_URL = 'http://127.0.0.1:1337/api/ingredients'; // Local API endpoint
// Assuming we don't need auth or have a token if it's local, but we might. 
// However, interacting directly via Strapi internal documents API is safer inside a strapi script if we can run it through strapi.
// But as external script, we might need a token or we can just seed it via Firebase directly... Wait, to migrate TO strapi, we either use REST API or better to run it via Strapi app context.

