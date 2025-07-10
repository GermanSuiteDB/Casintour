# Reglas para la Creación de Ramas y Flujos de Trabajo

Este repositorio sigue una estructura de ramas simple para organizar el código entre Sandbox y Producción en NetSuite. 

## Estructura de ramas principales

- `main`: Contiene el código actualmente desplegado en **NetSuite Producción**.
- `develop`: Contiene el código actualmente desplegado en **NetSuite Sandbox**.

> 🚫 **Está totalmente prohibido hacer push directamente a `main` o `develop`.**

---

## Tipos de ramas

Se manejan dos tipos de ramas principales para el desarrollo:

### `feature/`  
Usada para el desarrollo de nuevas funcionalidades, personalizaciones o integraciones.

- Se crea desde: `develop`
- Se mergea a: `develop` una vez finalizado y aprobado por el cliente
- Luego se mergea a: `main` cuando esté listo para pasar a producción

### `hotfix/`  
Usada para resolver errores urgentes detectados en producción.

- Se crea desde: `main`
- Se mergea directamente a: `main`

---

## Convención de nombres de ramas

La nomenclatura para nombrar ramas es:

Para una tarea en Jira con ID `SCN-38` y descripción “Creación Employees Integración Nominaz”:

- Rama para desarrollo:  
  `feature/scn-38-creacion-employees-integracion-nominaz`

- Rama para hotfix:  
  `hotfix/scn-38-creacion-employees-integracion-nominaz`

---

## Aprobación de Pull Requests

- ❌ No se permite el **auto-aprobado** de merges.
- ✅ Se debe **asignar un aprobador** antes de realizar el merge (usualmente **German**).

---

## Buenas prácticas

- Mantener las ramas actualizadas realizando el push correspondiente antes de finalizar la jornada.
- Incluir el ID de Jira en el nombre de la rama para facilitar el seguimiento.
- Realizar commits con mensajes detallados.

