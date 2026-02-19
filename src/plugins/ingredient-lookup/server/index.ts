
import recipeImportController from './controllers/recipe-import';
import register from './register';
import routes from './routes';
import recipeImportService from './services/recipe-import';

export default {
    register,
    controllers: {
        recipeImport: recipeImportController,
    },
    services: {
        recipeImport: recipeImportService,
    },
    routes,
};
