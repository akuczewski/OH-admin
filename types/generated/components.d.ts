import type { Schema, Struct } from '@strapi/strapi';

export interface SharedIngredient extends Struct.ComponentSchema {
  collectionName: 'components_shared_ingredients';
  info: {
    displayName: 'Sk\u0142adnik';
    icon: 'shopping-cart';
  };
  attributes: {
    amount: Schema.Attribute.Decimal;
    ingredient: Schema.Attribute.Relation<'oneToOne', 'api::skladnik.skladnik'>;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.CustomField<'plugin::ingredient-lookup.ingredient'>;
    slug: Schema.Attribute.String;
    unit: Schema.Attribute.Enumeration<
      [
        'g',
        'ml',
        'szt',
        'lyzka',
        'lyzeczka',
        'szklanka',
        '\u0142y\u017Cka',
        '\u0142y\u017Ceczka',
        'szklanka',
        'szczypta',
        'plaster',
        'garstka',
        'opakowanie',
        'sztuka',
      ]
    > &
      Schema.Attribute.Required;
    weight: Schema.Attribute.Decimal;
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
