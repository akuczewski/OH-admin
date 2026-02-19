
import {
    Alert,
    Box,
    Button,
    ContentLayout,
    Flex,
    HeaderLayout,
    Loader,
    Main,
    TextInput,
    Typography,
} from '@strapi/design-system';
import { Magic } from '@strapi/icons';
import { useFetchClient } from '@strapi/strapi/admin';
import React, { useState } from 'react';

const HomePage = () => {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const { post } = useFetchClient();

    const handleImport = async () => {
        if (!url) return;

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await post('/ingredient-lookup/import-url', { url });
            setSuccess(`Sukces! Zaimportowano przepis: ${response.data.data.name} (Draft ID: ${response.data.data.id})`);
            setUrl('');
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error?.message || 'Wystąpił błąd podczas importu. Sprawdź konsolę.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Main>
            <HeaderLayout
                title="Smart Recipe Importer"
                subtitle="Wklej link do przepisu (np. z Kwestii Smaku), a AI przygotuje dla Ciebie Draft w CMS."
                as="h2"
            />
            <ContentLayout>
                <Box padding={8} background="neutral0" hasRadius shadow="filterShadow">
                    <Flex direction="column" alignItems="stretch" gap={4}>
                        <Typography variant="beta">Importuj z URL</Typography>

                        <Box>
                            <TextInput
                                placeholder="https://www.kwestiasmaku.com/..."
                                label="Link do przepisu"
                                name="url"
                                hint="AI pobierze treść, wyliczy makra i zmapuje składniki na bazę Firebase."
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                                value={url}
                                disabled={isLoading}
                            />
                        </Box>

                        <Button
                            variant="default"
                            startIcon={<Magic />}
                            onClick={handleImport}
                            loading={isLoading}
                            fullWidth
                        >
                            Uruchom Magię AI
                        </Button>

                        {isLoading && (
                            <Flex direction="column" alignItems="center" paddingTop={4} gap={2}>
                                <Loader small>AI analizuje przepis... to może potrwać do 30 sekund.</Loader>
                            </Flex>
                        )}

                        {error && (
                            <Alert title="Błąd" variant="danger" onClose={() => setError(null)} closeLabel="Zamknij">
                                {error}
                            </Alert>
                        )}

                        {success && (
                            <Alert title="Gotowe!" variant="success" onClose={() => setSuccess(null)} closeLabel="Zamknij">
                                {success}
                            </Alert>
                        )}
                    </Flex>
                </Box>
            </ContentLayout>
        </Main>
    );
};

export default HomePage;
