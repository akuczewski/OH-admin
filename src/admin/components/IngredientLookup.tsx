import {
    Combobox,
    ComboboxOption,
    Field
} from '@strapi/design-system';
// @ts-ignore
import { useFetchClient } from '@strapi/strapi/admin'; // Strapi 5 standard import
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

export const Input = ({
    name,
    onChange,
    value,
    intlLabel,
    disabled,
    error,
    description,
    required,
}: {
    name: string;
    onChange: any;
    value: string;
    intlLabel: any;
    disabled?: boolean;
    error?: any;
    description?: any;
    required?: boolean;
}) => {
    const { formatMessage } = useIntl();
    const [options, setOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchValue, setSearchValue] = useState(value || '');
    const { get } = useFetchClient();

    useEffect(() => {
        if (searchValue.length < 2) {
            setOptions([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const { data } = await get(`/api/ingredients/search?q=${searchValue}`);
                setOptions(data || []);
            } catch (err) {
                console.error('Search error', err);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchValue, get]);

    const handleInputChange = (e: any) => {
        setSearchValue(e.target.value);
    };

    const handleSelect = (selectedValue: string) => {
        onChange({ target: { name, value: selectedValue, type: 'string' } });
    };

    return (
        <Field.Root name={name} id={name} error={error} hint={description} required={required}>
            <Field.Label>{formatMessage(intlLabel)}</Field.Label>
            <Combobox
                placeholder="Zacznij pisać nazwę składnika..."
                disabled={disabled}
                value={value}
                onChange={handleSelect}
                onInputChange={handleInputChange}
                loading={isLoading}
            >
                {options.map((opt: any) => (
                    <ComboboxOption key={opt.slug} value={opt.name}>
                        {opt.name} ({opt.category})
                    </ComboboxOption>
                ))}
            </Combobox>
            <Field.Hint />
            <Field.Error />
        </Field.Root>
    );
};
