# Imagen oficial de Bun
FROM oven/bun:1

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar los archivos de dependencias
COPY package.json bun.lock ./

# Instalar las dependencias
RUN bun install --frozen-lockfile

# Copiar el código del proyecto
COPY . .

# Puerto utilizado por la API
EXPOSE 3000

# Ejecutar el servidor
CMD ["bun", "run", "start"]