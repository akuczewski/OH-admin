import type { Schema, Struct } from '@strapi/strapi';

export interface ConsultationBenefit extends Struct.ComponentSchema {
  collectionName: 'components_consultation_benefits';
  info: {
    description: 'Punkt sekcji "Co dostajesz" na stronie eksperta (landing + apka).';
    displayName: 'Korzy\u015B\u0107 konsultacji';
    icon: 'check';
  };
  attributes: {
    icon: Schema.Attribute.Enumeration<
      ['chat', 'chart', 'clipboard', 'leaf', 'pill', 'calendar']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'chat'>;
    subtitle: Schema.Attribute.String;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface DietMacroTargets extends Struct.ComponentSchema {
  collectionName: 'components_diet_macro_targets';
  info: {
    description: 'Zakres % kalorii z bia\u0142ka, w\u0119glowodan\u00F3w i t\u0142uszczu dla programu (SPEC-dieta-silnik 3c).';
    displayName: 'Cel makrosk\u0142adnik\u00F3w';
    icon: 'chartPie';
  };
  attributes: {
    carbsMax: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    carbsMin: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    fatMax: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    fatMin: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    proteinMax: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    proteinMin: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
  };
}

export interface SharedIngredient extends Struct.ComponentSchema {
  collectionName: 'components_shared_ingredients';
  info: {
    displayName: 'Sk\u0142adnik';
    icon: 'shopping-cart';
  };
  attributes: {
    amount: Schema.Attribute.Decimal;
    ingredient: Schema.Attribute.Relation<'oneToOne', 'api::skladnik.skladnik'>;
    maxAdjustPercentOverride: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.CustomField<'plugin::ingredient-lookup.ingredient'>;
    scalingOverride: Schema.Attribute.Enumeration<
      ['locked', 'limited', 'flexible', 'functional']
    >;
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
      'consultation.benefit': ConsultationBenefit;
      'diet.macro-targets': DietMacroTargets;
      'shared.ingredient': SharedIngredient;
      'shared.macros': SharedMacros;
    }
  }
}
