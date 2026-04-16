
import ingredientController from './controllers/ingredient';
import recipeImportController from './controllers/recipe-import';
import register from './register';
import routes from './routes';
import ingredientService from './services/ingredient';
import recipeImportService from './services/recipe-import';

export default {
    register,
    controllers: {
        ingredient: ingredientController,
        recipeImport: recipeImportController,
    },
    services: {
        ingredient: ingredientService,
        recipeImport: recipeImportService,
    },
    routes,
};
