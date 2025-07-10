/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */

define(['N/search', 'N/record', 'N/https', 'N/runtime'],
    // test
    function (search, record, https, runtime) {
        let headers = {
            'User-Agent': 'Suitelet',
            'Connection': 'keep-alive',
            'not-version': 'any',
            'Content-Type': 'application/json'
        }
        const baseURL = 'https://cloud.nominaz.com';
        const urlToken = '/role_manager/oauth2/token';
        const urlEmployees = '/nominaz/server/index.php/nominaz/reportes/ObtenerReporteEmpleados';
        const urlPayments = '/report/horizontal_payroll';
        const bodyEmployees = {
            "data": {
                "filtros": {
                    "estado": "A"
                },
                "conceptosFiltrados": [
                    "documento",
                    "nombre",
                    "apellido",
                    "codigoIess",
                    "genero",
                    "tipoDocumento",
                    "paisResidencia",
                    "paisNacimiento",
                    "provinciaResidencia",
                    "ciudadResidencia",
                    "direccion",
                    "telefonos",
                    "celular",
                    "email",
                    "fechaNacimiento",
                    "estadoCivil",
                    "nombrePareja",
                    "hijos",
                    "numeroHijos",
                    "cargaFamiliarHijo",
                    "asistencia",
                    "fechaIngreso",
                    "fechaSalida",
                    "nivelUno",
                    "nivelDos",
                    "nivelTres",
                    "nivelCuatro",
                    "turno",
                    "cargo",
                    "jefeDirecto"
                ]
            }
        };
        let bodyPayments = {
            "conceptos": ["00001-CRI", "00002-CRI", "00022-CRD", "00023-CRD", "00007-CRP", "00008-CRP"],
            "datosBusqueda": {
                "preliquidacionHabilitada": false
            },
            "agrupar": false
        }

        function getInputData() {
            try {
              return
                //get token
                let scriptObj = runtime.getCurrentScript();
                var clientId = scriptObj.getParameter({ name: 'custscript_sdb_client_id_nominaz' });
                var clientSecret = scriptObj.getParameter({ name: 'custscript_sdb_client_secret_nominaz' });
                const bodyToken = {
                    "client_id": clientId,
                    "client_secret": clientSecret,
                    "grant_type": "client_credentials"
                };
                let responseToken = postRequest(baseURL + urlToken, bodyToken);
                let token = responseToken?.body ? JSON.parse(responseToken.body)?.response?.accessToken : null;
                if (!token) {
                    log.error('could not generate token', responseToken)
                    return [];
                }
                headers['x-api-key-nominaz'] = token;

                //get employees
                let responseEmployees = postRequest(baseURL + urlEmployees, bodyEmployees);
                let employees = responseEmployees?.body ? JSON.parse(responseEmployees.body)?.response : null;
                if (!employees || !employees.length) {
                    log.error('could not obtain employee list', responseEmployees)
                    return [];
                }

                //set date range for payments
                let useParameters = scriptObj.getParameter({ name: 'custscript_use_parameters' });
                if (useParameters) {
                    bodyPayments.datosBusqueda["fechaDesde"] = scriptObj.getParameter({ name: 'custscript_date_from' });
                    bodyPayments.datosBusqueda["fechaHasta"] = scriptObj.getParameter({ name: 'custscript_date_to' });
                } else {
                    bodyPayments.datosBusqueda["fechaDesde"] = "1970-01-01";
                    const date = new Date();
                    const year = date.getFullYear();
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const day = date.getDate().toString().padStart(2, '0');
                    const today = `${year}-${month}-${day}`;
                    bodyPayments.datosBusqueda["fechaHasta"] = today;
                }

                //get payments
                let responsePayments = postRequest(baseURL + urlPayments, bodyPayments);
                let payments = responsePayments?.body ? JSON.parse(responsePayments.body)?.response : null;
                if (!payments) {
                    log.error('could not obtain payments list', responsePayments)
                    return [];
                }
                employees.push(payments);

                return employees;
            } catch (error) {
                log.error({
                    title: 'Error in getInputData function',
                    details: error.message
                })
            }
        }

        function map(context) {
            try {
              return
                var data = JSON.parse(context.value);
                // log.debug("map data", data);
                if (data.documento !== '0919352740') return;

                //send payment information to reduce step
                // if (data.nomina) {
                //     for (let i = 0; i < data.nomina.length; i++) {
                //         const payment = data.nomina[i];
                //         if (payment.codigo) context.write({ key: payment.codigo, value: payment });
                //     }
                //     return;
                // }

                //search for employee
                let firstName = data.nombre.trim();
                let lastName = data.apellido.trim();
                let existingId = searchEmployeeId(firstName, lastName);

                let employee;
                let employeePhone = data.celular.trim() || null;
                //create employee if it does not exist
                if (existingId === -1) {
                    employee = record.create({
                        type: record.Type.EMPLOYEE,
                        isDynamic: true
                    });
                    employee.setValue({
                        fieldId: 'firstname',
                        value: firstName
                    }).setValue({
                        fieldId: 'lastname',
                        value: lastName
                    })

                    //employee address
                    let employeeAddrs1 = data.direccion.trim() || null;
                    let employeeCountry = data.paisResidencia.trim() || null;
                    let employeeCity = data.ciudadResidencia.trim() || null;
                    let employeeState = data.provinciaResidencia.trim() || null;
                    if (employeeAddrs1 && employeeCountry && employeeCity) {
                        employee.selectNewLine({
                            sublistId: 'addressbook'
                        });
                        let employeeNewAddress = employee.getCurrentSublistSubrecord({
                            sublistId: 'addressbook',
                            fieldId: 'addressbookaddress'
                        });
                        employeeNewAddress.setText({
                            fieldId: 'country',
                            value: employeeCountry
                        });
                        employeeNewAddress.setValue({
                            fieldId: 'addr1',
                            value: employeeAddrs1
                        });
                        employeeNewAddress.setValue({
                            fieldId: 'city',
                            value: employeeCity
                        });
                        if (employeeState) employeeNewAddress.setValue({
                            fieldId: 'state',
                            value: employeeState
                        });
                        if (employeePhone) employeeNewAddress.setValue({
                            fieldId: 'addrphone',
                            value: employeePhone
                        });
                        employee.commitLine({
                            sublistId: 'addressbook'
                        });
                    }
                } else {
                    employee = record.load({
                        type: record.Type.EMPLOYEE,
                        id: existingId,
                        isDynamic: true
                    })
                }

                employee.setValue({
                    fieldId: 'jobdescription',
                    value: data.cargo.trim()
                }).setValue({
                    fieldId: 'email',
                    value: data.email.trim()
                }).setValue({
                    fieldId: 'birthdate',
                    value: parseDate(data.fechaNacimiento.trim())
                }).setValue({
                    fieldId: 'hiredate',
                    value: parseDate(data.fechaIngreso.trim())
                }).setValue({
                    fieldId: 'comments',
                    value: `Document: ${data.documento.trim()}`
                }).setValue({
                    fieldId: 'employeestatus',
                    value: 2
                }).setValue({
                    fieldId: 'custentity_sdb_turno_nominaz',
                    value: data.turno.trim()
                })

                if (employeePhone) employee.setValue({
                    fieldId: 'mobilephone',
                    value: employeePhone
                })

                let gender = getGender(data.genero.trim());
                employee.setValue({
                    fieldId: 'gender',
                    value: gender
                })
                let phone = getPhone(data.telefonos);
                if (phone) employee.setValue({
                    fieldId: 'phone',
                    value: phone
                })
                let hasChildren = parseBool(data.hijos);
                employee.setValue({
                    fieldId: 'custentity_sdb_hijos_nominaz',
                    value: hasChildren
                })
                let childCount = 0;
                let childLoad = 0;
                if (hasChildren) {
                    childCount = parseNumber(data.numeroHijos);
                    childLoad = parseNumber(data.cargaFamiliarHijo);
                }
                employee.setValue({
                    fieldId: 'custentity_sdb_numero_hijos_nominaz',
                    value: childCount
                })
                employee.setValue({
                    fieldId: 'custentity_sdb_carga_fam_hij_nominaz',
                    value: childLoad
                })
                let asistance = parseBool(data.asistencia);
                employee.setValue({
                    fieldId: 'custentity_sdb_asistencia_nominaz',
                    value: asistance
                })
                let civilStatus = getCivilStatus(employee, data.estadoCivil);
                if (civilStatus) employee.setValue({
                    fieldId: 'maritalstatus',
                    value: civilStatus
                })
                let partnerName = getCouplesName(data.nombrePareja);
                if (partnerName) employee.setValue({
                    fieldId: 'custentity_sdb_nombre_pareja_nominaz',
                    value: partnerName
                })
                let supervisor = searchEmployeeId(null, null, data.jefeDirecto.trim());
                if (supervisor !== -1) employee.setValue({
                    fieldId: 'supervisor',
                    value: supervisor
                })
                let employeeId = employee.save({
                    ignoreMandatoryFields: true
                });
                if (existingId === -1) log.audit('employee created', employeeId);
                else log.audit('employee updated', employeeId);
                // log.audit('employee created test', data.documento)

            } catch (error) {
                log.error({
                    title: 'Error in Map function',
                    details: error.message
                })
            }
        }

        function reduce(context) {
            try {
              return
                var data = JSON.parse(context.values);
                // log.debug("reduce data", data);

            } catch (error) {
                log.error({
                    title: 'Error in Reduce function',
                    details: error.message
                })
            }
        }

        function postRequest(url, JSONRequestBody) {
            try {
                var response = https.post({
                    body: JSON.stringify(JSONRequestBody),
                    url: url,
                    headers: headers
                });
                return response;
            } catch (error) {
                log.error({
                    title: 'Error in postRequest function',
                    details: error
                });
            }
        }

        function parseDate(dateStr) {
            let parts = dateStr.split("-");
            let day = parts[2];
            let month = parseInt(parts[1], 10) - 1;
            let year = parts[0].length === 2 ? "20" + parts[0] : parts[0];
            return new Date(year, month, day);
        }

        function searchEmployeeId(firstName, lastName, fullName) {
            let filters = [];
            if (fullName) {
                fullName = fullName.split(' ');
                firstName = fullName[0];
                lastName = fullName[1];
                let nameFilter = search.createFilter({
                    name: "formulatext",
                    formula: `CASE WHEN 
                    SUBSTR({firstname}, 0, LENGTH('${firstName}')) = '${firstName}' 
                    AND SUBSTR({lastname}, 0, LENGTH('${lastName}')) = '${lastName}' 
                    THEN 'T' ELSE 'F' END`,
                    join: null,
                    operator: search.Operator.IS,
                    values: "T"
                })
                filters.push(nameFilter)
                // filters = [
                //     [`formulatext: CASE WHEN 
                //         CONCAT(CONCAT({firstname}, ' '), {lastname})=
                //         '${fullName}' THEN 'T' ELSE 'F' END`, "is", "T"]
                // ]
            } else {
                filters = [
                    ["firstname", "is", firstName],
                    "AND",
                    ["lastname", "is", lastName]
                ];
            }
            var employeeSearchObj = search.create({
                type: "employee",
                filters: filters,
                columns:
                    [
                        search.createColumn({ name: "entityid", label: "Name" })
                    ]
            });
            let result = employeeSearchObj.run().getRange({
                start: 0,
                end: 1
            })
            return result.length ? result[0].id : -1;
        }

        function getGender(gender) {
            var notSpecified = 'ns';
            try {
                if (!gender) return notSpecified;
                if (gender === 'Masculino') return 'm';
                if (gender === 'Femenino') return 'f'
                return notSpecified;
            } catch (error) {
                log.error("getGender error", error);
                return notSpecified;
            }
        }



        //Revisar los posibles valores que trae la api para hacer vaidaciones, ya que a veces cuando el campo no tiene valor la api devuelve null, '','0'
        //Entonces antes de asginar el valor debeeriamos verificar que no sea ninguno de esos

        function getCivilStatus(employee, civilStatus) {
            var returnValue = null;
            try {
                if (!civilStatus) return returnValue;
                let field = employee.getField({
                    fieldId: 'maritalstatus'
                });
                let options = field.getSelectOptions({
                    filter: null
                });
                for (let i = 0; i < options.length; i++) {
                    const option = options[i];
                    if (option.text.trim().toUpperCase() === civilStatus.trim().toUpperCase()) {
                        returnValue = option.value;
                        break;
                    }
                }
                return returnValue;
            } catch (error) {
                log.error("getCivilStatus error", error);
                return returnValue;
            }
        }

        function parseBool(bool) {
            try {
                if (!bool) return false;
                if (bool.toUpperCase() === 'SI') return true;
                return false;
            } catch (error) {
                log.error("parseBool error", error);
                return false;
            }
        }
        function getPhone(phone) {
            try {
                if (!phone) return null;
                return phone.trim();
            } catch (error) {
                log.error("getPhone error", error);
                return null;
            }
        }
        function parseNumber(number) {
            try {
                if (!number) return 0;
                return parseInt(number);
            } catch (error) {
                log.error("parseNumber error", error);
                return 0;
            }
        }
        function getCouplesName(coupleName) {
            var notSpecified = null;
            try {
                if (!coupleName || coupleName === '0') return notSpecified;
                return coupleName.trim();
            } catch (error) {
                log.error("getCouplesName error", error);
                return notSpecified
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce
        }
    });
