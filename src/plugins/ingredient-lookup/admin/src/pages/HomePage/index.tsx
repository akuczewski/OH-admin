// @ts-ignore
import { useFetchClient } from '@strapi/admin/strapi-admin';
import {
    Box,
    Button,
    Field,
    Flex,
    TextInput,
    Typography
} from '@strapi/design-system';
import { useState } from 'react';

const HomePage = () => {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const { post } = useFetchClient();

    const handleImport = async () => {
        if (!url) return;
        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            console.log('[RECIPE-IMPORTER] Sending URL to backend scrap:', url);
            const { data } = await post('/ingredient-lookup/import-url', { url });
            setResult(data);
            console.log('[RECIPE-IMPORTER] Success:', data);
        } catch (err: any) {
            console.error('[RECIPE-IMPORTER] Error:', err);
            setError(err.response?.data?.error?.message || err.message || 'Wystąpił błąd podczas importowania przpesiu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box padding={8} background="neutral100">
            <Box background="neutral0" padding={6} shadow="filterShadow" hasRadius>
                <Typography variant="alpha" marginBottom={4}>
                    Narzędzie Importu Przepisu
                </Typography>
                <Typography variant="epsilon" textColor="neutral600" marginBottom={6}>
                    Wklej adres URL przepisu (np. z Kwestia Smaku, Moje Wypieki, Jadłonomia), a system spróbuje pobrać nazwę, składniki i wygenerować Szkic przepisu.
                </Typography>

                <Flex gap={4} alignItems="flex-end" marginBottom={6}>
                    <Box flex={1}>
                        <Field.Root name="recipe-url" error={error}>
                            <Field.Label>Adres URL Przepisu</Field.Label>
                            <TextInput
                                placeholder="https://www.kwestiasmaku.com/przepis/..."
                                value={url}
                                onChange={(e: any) => setUrl(e.target.value)}
                            />
                            <Field.Error />
                        </Field.Root>
                    </Box>
                    <Button
                        size="L"
                        onClick={handleImport}
                        loading={isLoading}
                        disabled={!url}
                    >
                        Pobierz i Stwórz Szkic
                    </Button>
                </Flex>

                {result && (
                    <Box background="primary100" padding={4} hasRadius borderColor="primary200">
                        <Typography variant="delta" textColor="primary600" marginBottom={2}>
                            🎉 Sukces! Utworzono nowy szkic w bazie.
                        </Typography>
                        <Typography variant="omega" marginBottom={2}>
                            <strong>Tytuł:</strong> {result.title}
                        </Typography>
                        <Typography variant="omega" marginBottom={4}>
                            <strong>Znaleziono składników:</strong> {result.ingredientsFound}
                        </Typography>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                // Redirect to the newly created document
                                window.location.href = `/admin/content-manager/collection-types/api::recipe.recipe/${result.documentId}`;
                            }}
                        >
                            Przejdź do przepisu
                        </Button>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default HomePage;
