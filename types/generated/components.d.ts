import type { Schema, Struct } from '@strapi/strapi';

export interface SharedIngredient extends Struct.ComponentSchema {
  collectionName: 'components_shared_ingredients';
  info: {
    displayName: 'Sk\u0142adnik';
    icon: 'shopping-cart';
  };
  attributes: {
    amount: Schema.Attribute.Decimal;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    unit: Schema.Attribute.String;
  };
}

export interface SharedMacros extends Struct.ComponentSchema {
  collectionName: 'components_shared_macros';
  info: {
    displayName: 'Makrosk\u0142adniki';
    icon: 'chart-pie';
  };
  attributes: {
    carbs: Schema.Attribute.Integer;
    fat: Schema.Attribute.Integer;
    fiber: Schema.Attribute.Integer;
    protein: Schema.Attribute.Integer;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'shared.ingredient': SharedIngredient;
      'shared.macros': SharedMacros;
    }
  }
}
